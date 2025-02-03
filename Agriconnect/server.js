require('dotenv').config();
const express = require('express');
const path = require('path');
const bodyParser = require('body-parser');
const axios = require('axios');
const mysql = require('mysql2/promise');
const multer = require('multer');
const session = require('express-session');

const app = express();

const {
  PORT,
  DB_HOST, DB_USER, DB_PASSWORD, DB_NAME,
  INTERSWITCH_BASE_URL,
  INTERSWITCH_CLIENT_ID,
  INTERSWITCH_CLIENT_SECRET,
  APP_REDIRECT_URL
} = process.env;

let pool;
(async () => {
  pool = await mysql.createPool({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
})();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({
  secret: 'agriconnect_secret_key',
  resave: false,
  saveUninitialized: false
}));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'public/images');
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + file.originalname;
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

async function getAccessToken() {
  try {
    const url = `${INTERSWITCH_BASE_URL}/passport/oauth/token`;
    const authString = Buffer.from(`${INTERSWITCH_CLIENT_ID}:${INTERSWITCH_CLIENT_SECRET}`).toString('base64');
    const response = await axios.post(url, 'grant_type=client_credentials', {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${authString}`
      }
    });
    return response.data.access_token;
  } catch (error) {
    console.error('Error getting Interswitch token:', error.response?.data || error.message);
    throw new Error('Cannot get Interswitch token');
  }
}

async function createNotification(userId, message) {
  await pool.execute(
    `INSERT INTO notifications (user_id, message) VALUES (?, ?)`,
    [userId, message]
  );
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});
app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'register.html'));
});
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});
app.get('/profile', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});
app.get('/tools', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'tools.html'));
});
app.get('/add-tool', (req, res) => {
  if (!req.session.user || req.session.user.role !== 'enterprise') {
    return res.status(403).send('Forbidden. Only enterprise can add tools.');
  }
  res.sendFile(path.join(__dirname, 'views', 'add-tool.html'));
});
app.get('/notifications', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'notifications.html'));
});
app.get('/chat', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});
app.get('/payment', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'payment.html'));
});

app.post('/register', async (req, res) => {
  try {
    const { email, password, role, fullName, phone } = req.body;
    if (!email || !password || !role) return res.status(400).send('Missing fields');
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return res.status(400).send('User already exists.');
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, role, full_name, phone) VALUES (?, ?, ?, ?, ?)',
      [email, password, role, fullName || '', phone || '']
    );
    const newUserId = result.insertId;
    req.session.user = {
      id: newUserId,
      email,
      role,
      fullName: fullName || '',
      phone: phone || ''
    };
    res.redirect('/tools');
  } catch (error) {
    console.error('Error register:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = rows[0];
    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      phone: user.phone
    };
    res.json({ success: true });
  } catch (error) {
    console.error('Error login:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

app.post('/profile', async (req, res) => {
  try {
    if (!req.session.user) return res.redirect('/login');
    const { fullName, phone } = req.body;
    await pool.execute('UPDATE users SET full_name = ?, phone = ? WHERE id = ?', [fullName, phone, req.session.user.id]);
    req.session.user.fullName = fullName;
    req.session.user.phone = phone;
    res.redirect('/profile');
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/api/tools', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const [rows] = await pool.execute(`
      SELECT t.*, u.email AS owner_email 
      FROM tools t 
      JOIN users u ON t.owner_id = u.id
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/add-tool', upload.single('toolImage'), async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'enterprise') {
      return res.status(403).send('Forbidden');
    }
    const { name, buyPrice, rentPrice } = req.body;
    let imagePath = null;
    if (req.file) imagePath = '/images/' + req.file.filename;
    await pool.execute(
      'INSERT INTO tools (name, image_path, buy_price, rent_price, owner_id) VALUES (?, ?, ?, ?, ?)',
      [name, imagePath, buyPrice, rentPrice, req.session.user.id]
    );
    res.redirect('/tools');
  } catch (error) {
    console.error('Error adding tool:', error);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/create-bill', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'farmer') {
      return res.status(403).json({ success: false, message: 'Only a farmer can buy or rent tools.' });
    }
    const { toolId, action } = req.body;
    if (!toolId || !action) {
      return res.status(400).json({ success: false, message: 'Missing toolId or action.' });
    }
    const [toolRows] = await pool.execute('SELECT * FROM tools WHERE id = ?', [toolId]);
    if (toolRows.length === 0) return res.status(404).json({ success: false, message: 'Tool not found.' });
    const tool = toolRows[0];
    let amount = (action === 'buy') ? tool.buy_price : (action === 'rent') ? tool.rent_price : null;
    if (!amount) return res.status(400).json({ success: false, message: 'Invalid action.' });

    const userId = req.session.user.id;
    const transactionRef = `TOOL-${toolId}-${Date.now()}`;

    await pool.execute(
      `INSERT INTO payments (user_id, tool_id, amount, status, transaction_ref)
       VALUES (?, ?, ?, 'PENDING', ?)`,
      [userId, toolId, amount, transactionRef]
    );

    const accessToken = await getAccessToken();
    const redirectURLWithRef = APP_REDIRECT_URL + '?transactionreference=' + transactionRef;
    const url = `${INTERSWITCH_BASE_URL}/paymentgateway/api/v1/paybill`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    };

    const body = {
      merchantCode: 'MX6072',
      payableCode: '9405967',
      amount: `${amount}`,
      redirectUrl: redirectURLWithRef,
      customerId: req.session.user.email,
      currencyCode: '566',
      customerEmail: req.session.user.email,
      transactionReference: transactionRef
    };

    const responseISW = await axios.post(url, body, { headers });
    const data = responseISW.data;

    return res.json({
      success: true,
      message: 'Bill created successfully',
      data
    });
  } catch (error) {
    console.error('Error create-bill:', error.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Error creating bill',
      error: error.response?.data || error.message
    });
  }
});

app.all('/payment-callback', async (req, res) => {
  try {
    console.log('Callback query:', req.query);
    console.log('Callback body:', req.body);
    const transactionReference = req.query.transactionreference || req.body.txnref;
    if (!transactionReference) return res.send('No transaction reference provided.');

    let paymentStatus = 'FAILED';
    if (req.body && req.body.resp && req.body.resp === '00') {
      paymentStatus = 'SUCCESS';
    } else {
      const accessToken = await getAccessToken();
      const url = `${INTERSWITCH_BASE_URL}/collections/api/v1/gettransaction?merchantcode=MX6072&transactionreference=${transactionReference}&amount=0`;
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      };
      try {
        const response = await axios.get(url, { headers });
        const data = response.data;
        if (data.ResponseCode === '00') paymentStatus = 'SUCCESS';
      } catch (err) {
        console.warn('Error verifying payment, simulating SUCCESS for demo:', err.message);
        paymentStatus = 'SUCCESS';
      }
    }

    await pool.execute(
      `UPDATE payments SET status = ? WHERE transaction_ref = ?`,
      [paymentStatus, transactionReference]
    );

    const [[paymentRow]] = await pool.execute(
      `SELECT p.*, t.name as tool_name, t.owner_id
       FROM payments p JOIN tools t ON p.tool_id = t.id
       WHERE p.transaction_ref = ?`,
      [transactionReference]
    );
    const [[farmerUser]] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [paymentRow.user_id]);
    const [[enterpriseUser]] = await pool.execute(`SELECT * FROM users WHERE id = ?`, [paymentRow.owner_id]);

    if (paymentStatus === 'SUCCESS') {
      await createNotification(farmerUser.id, `Your payment for '${paymentRow.tool_name}' was successful!`);
      await createNotification(enterpriseUser.id, `${farmerUser.full_name || farmerUser.email} has paid for '${paymentRow.tool_name}'.`);

      return res.send(`
        <html>
          <head>
            <meta charset="UTF-8"/>
            <title>Payment Success</title>
            <link rel="stylesheet" href="/css/style.css">
          </head>
          <body>
            <header>
              <h1>Agriconnect</h1>
              <nav>
                <a href="/tools">Tools</a> |
                <a href="/profile">Profile</a> |
                <a href="/notifications">Notifications</a> |
                <a href="/chat">Chat</a> |
                <a href="/logout">Logout</a>
              </nav>
            </header>
            <div class="container">
              <h2>Payment Success</h2>
              <p>Thank you, ${farmerUser.full_name || farmerUser.email}! Your payment for <strong>${paymentRow.tool_name}</strong> was successful.</p>
              <p>The enterprise <strong>${enterpriseUser.email}</strong> has been notified.</p>
              <p><a href="/tools">Go back to Tools</a></p>
            </div>
            <footer>
              <p>&copy; 2025 Agriconnect</p>
            </footer>
          </body>
        </html>
      `);
    } else {
      return res.send(`
        <html>
          <head>
            <meta charset="UTF-8"/>
            <title>Payment Failed</title>
            <link rel="stylesheet" href="/css/style.css">
          </head>
          <body>
            <header>
              <h1>Agriconnect</h1>
              <nav>
                <a href="/tools">Tools</a> |
                <a href="/profile">Profile</a> |
                <a href="/notifications">Notifications</a> |
                <a href="/chat">Chat</a> |
                <a href="/logout">Logout</a>
              </nav>
            </header>
            <div class="container">
              <h2>Payment Failed</h2>
              <p>Sorry, your payment did not go through. Please try again or contact support.</p>
              <p><a href="/tools">Back to Tools</a></p>
            </div>
            <footer>
              <p>&copy; 2025 Agriconnect</p>
            </footer>
          </body>
        </html>
      `);
    }
  } catch (error) {
    console.error('Error in payment-callback:', error.message);
    return res.status(500).send('Internal Server Error in payment callback.');
  }
});

app.get('/api/notifications', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const [rows] = await pool.execute(
      `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC`,
      [req.session.user.id]
    );
    res.json(rows);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/notifications/read', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { notificationId } = req.body;
    if (!notificationId) return res.status(400).json({ error: 'notificationId missing' });
    await pool.execute(
      `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      [notificationId, req.session.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/profile', (req, res) => {
  if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json(req.session.user);
});

app.get('/chat', (req, res) => {
  if (!req.session.user) return res.redirect('/login');
  res.sendFile(path.join(__dirname, 'views', 'chat.html'));
});

app.post('/api/messages', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const { receiverEmail, message } = req.body;
    if (!receiverEmail || !message) return res.status(400).json({ error: 'Missing receiverEmail or message' });
    
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [receiverEmail]);
    if (rows.length === 0) return res.status(404).json({ error: 'Receiver not found' });
    const receiver = rows[0];
    const senderId = req.session.user.id;
    const receiverId = receiver.id;
    
    await pool.execute(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [senderId, receiverId, message]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ error: 'Unauthorized' });
    const receiverEmail = req.query.with;
    if (!receiverEmail) return res.status(400).json({ error: 'Missing receiverEmail in query parameter "with"' });
    const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [receiverEmail]);
    if (rows.length === 0) return res.status(404).json({ error: 'Receiver not found' });
    const receiver = rows[0];
    const currentUserId = req.session.user.id;
    const receiverId = receiver.id;
    const [messages] = await pool.execute(
      `SELECT * FROM messages 
       WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
       ORDER BY created_at ASC`,
       [currentUserId, receiverId, receiverId, currentUserId]
    );
    res.json(messages);
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const http = require('http').createServer(app);
const io = require('socket.io')(http);

io.on('connection', (socket) => {
    console.log('New client connected: ' + socket.id);

    socket.on('sendMessage', async (data) => {
        try {
            const [rows] = await pool.execute('SELECT * FROM users WHERE email = ?', [data.receiverEmail]);
            if (rows.length === 0) return;
            const receiver = rows[0];
            await pool.execute(
                'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
                [data.senderId, receiver.id, data.message]
            );
            io.emit('newMessage', data);
        } catch (error) {
            console.error('Error in socket sendMessage:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected: ' + socket.id);
    });
});

const httpPort = PORT || 3000;
http.listen(httpPort, () => {
    console.log(`Agriconnect running at http://localhost:${httpPort}`);
});
