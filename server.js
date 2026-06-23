const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const mongoose = require('mongoose');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// debug: log POST request bodies to console (helps Render logs)
app.use((req, res, next) => {
    if (req.method === 'POST') {
        try { console.log(`[REQ BODY] ${new Date().toISOString()} ${req.method} ${req.url} ${JSON.stringify(req.body)}`); } catch (e) { console.log('[REQ BODY] unable to stringify body'); }
    }
    next();
});

app.set('trust proxy', 1);
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' }
}));

// logging
app.use((req, res, next) => {
    const log = `[${new Date().toISOString()}] ${req.method} ${req.url}\n`;
    try { fs.appendFileSync(path.join(__dirname, 'access.log'), log); } catch (e) {}
    next();
});

// serve static front-end
app.use(express.static(path.join(__dirname, 'public')));

// Simple data storage fallback (file-based) used if no MongoDB URI provided
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const ENTRIES_FILE = path.join(__dirname, 'data', 'entries.json');

let UserModel = null;
let EntryModel = null;

const startServer = async () => {
    if (process.env.MONGO_URI) {
        try {
            await mongoose.connect(process.env.MONGO_URI, { dbName: process.env.MONGO_DB || 'sonydb' });
            const userSchema = new mongoose.Schema({ username: String, passwordHash: String });
            const entrySchema = new mongoose.Schema({ userId: String, amount: Number, type: String, category: String, description: String, createdAt: Date });
            UserModel = mongoose.model('User', userSchema);
            EntryModel = mongoose.model('Entry', entrySchema);
            console.log('Connected to MongoDB');
        } catch (err) {
            console.error('Mongo connection failed, falling back to file storage', err.message);
        }
    }

    app.listen(PORT, () => {
        console.log(`Server running at: http://localhost:${PORT}`);
    });
};

// helper file-based persistence
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8') || '[]'); } catch (e) { return []; } };
const writeJson = (p, data) => { fs.writeFileSync(p, JSON.stringify(data, null, 2)); };

// auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId) return next();
    const info = `[${new Date().toISOString()}] Unauthorized access attempt: ${req.method} ${req.url} from ${req.ip}\n`;
    try { fs.appendFileSync(path.join(__dirname, 'access.log'), info); } catch (e) {}
    res.status(401).json({ error: 'Unauthorized' });
};

// Routes
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    if (String(password).length < 6) return res.status(400).json({ error: 'Password too short' });

    const passwordHash = await bcrypt.hash(password, 10);

    if (UserModel) {
        const exists = await UserModel.findOne({ username }).lean();
        if (exists) return res.status(400).json({ error: 'User exists' });
        const u = await UserModel.create({ username, passwordHash });
        req.session.userId = String(u._id);
        return res.status(201).json({ ok: true });
    }

    const users = readJson(USERS_FILE);
    if (users.find(u => u.username === username)) return res.status(400).json({ error: 'User exists' });
    const id = Date.now().toString(36);
    users.push({ id, username, passwordHash });
    writeJson(USERS_FILE, users);
    req.session.userId = id;
    res.status(201).json({ ok: true });
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (UserModel) {
        const user = await UserModel.findOne({ username }).lean();
        if (!user) return res.status(401).json({ error: 'Invalid' });
        const match = await bcrypt.compare(password, user.passwordHash);
        if (!match) return res.status(401).json({ error: 'Invalid' });
        req.session.userId = String(user._id);
        return res.json({ ok: true });
    }
    const users = readJson(USERS_FILE);
    const user = users.find(u => u.username === username);
    if (!user) return res.status(401).json({ error: 'Invalid' });
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid' });
    req.session.userId = user.id;
    res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
});

// Accounts (entries) endpoints
app.get('/api/accounts', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    if (EntryModel) {
        const entries = await EntryModel.find({ userId }).lean();
        return res.json(entries);
    }
    const entries = readJson(ENTRIES_FILE).filter(e => e.userId === userId);
    res.json(entries);
});

app.post('/api/accounts', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const { amount, type, category, description } = req.body;
    try {
        const parsedAmount = Number(amount);
        if (Number.isNaN(parsedAmount)) return res.status(400).json({ error: 'Invalid amount' });
        const entry = { id: Date.now().toString(36), userId, amount: parsedAmount || 0, type: type || 'expense', category: category || '其他', description: description || '', createdAt: new Date() };

        // log the incoming request for debugging
        const info = `[${new Date().toISOString()}] CREATE entry user=${userId} body=${JSON.stringify(req.body)}\n`;
        try { fs.appendFileSync(path.join(__dirname, 'access.log'), info); } catch (e) {}

        if (EntryModel) {
            // avoid passing custom 'id' to MongoDB (prevents casting issues)
            const doc = { userId: entry.userId, amount: entry.amount, type: entry.type, category: entry.category, description: entry.description, createdAt: entry.createdAt };
            const created = await EntryModel.create(doc);
            return res.status(201).json({ ok: true, entry: { _id: created._id, amount: created.amount, type: created.type, category: created.category, description: created.description, createdAt: created.createdAt } });
        }
        const all = readJson(ENTRIES_FILE);
        all.push(entry);
        writeJson(ENTRIES_FILE, all);
        res.status(201).json({ ok: true, entry });
    } catch (err) {
        const errMsg = err && err.message ? err.message : String(err);
        // write to file for local debugging
        try { fs.appendFileSync(path.join(__dirname, 'error.log'), `[${new Date().toISOString()}] accounts POST error: ${errMsg}\n`); } catch (e) {}
        // also log to console so Render shows it in service logs
        console.error('accounts POST error', err);
        res.status(500).json({ error: 'Server error', detail: errMsg });
    }
});

app.delete('/api/accounts/:id', requireAuth, async (req, res) => {
    const userId = req.session.userId;
    const id = req.params.id;
    if (EntryModel) {
        try {
            let doc = null;
            try {
                doc = await EntryModel.findOneAndDelete({ _id: id, userId });
            } catch (e) {
                // possible CastError when id is not an ObjectId - fallback to matching custom 'id' field
                doc = await EntryModel.findOneAndDelete({ id: id, userId });
            }
            if (!doc) return res.status(404).json({ error: 'Not found' });
            return res.json({ ok: true });
        } catch (e) {
            console.error('delete entry error', e);
            return res.status(500).json({ error: 'Server error' });
        }
    }
    const all = readJson(ENTRIES_FILE);
    const idx = all.findIndex(e => e.id === id && e.userId === userId);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    all.splice(idx, 1);
    writeJson(ENTRIES_FILE, all);
    res.json({ ok: true });
});

// fallback product & admin routes kept for compatibility
try {
    const { data: lenses } = require('./data/lens.json');
    app.get('/product/:model.html', (req, res) => {
        const modelParam = req.params.model;
        const product = lenses.find(item => item.model === modelParam);
        if (product) {
            res.status(200).send(`
                <html>
                    <body style="font-family: sans-serif; text-align: center;">
                        <h1>${product.name}</h1>
                        <p>型號：${product.model}</p>
                        <img src="/images/${product.imageUrl}" alt="${product.name}" style="width:400px;">
                        <br><br>
                        <a href="/">回首頁</a>
                    </body>
                </html>
            `);
        } else {
            res.status(404).send('<h1>404 找不到型號</h1>');
        }
    });
} catch (e) {}

app.get('/admin', (req, res) => {
    if (req.query.code === '521') return res.status(200).send('<h1>Welcome to Admin (歡迎進入後台)</h1>');
    res.status(403).send('<h1>Access Denied (暗號錯誤)</h1>');
});

app.all(/.*$/, (req, res) => {
    res.status(404).send('<h1>404 Not Found (抱歉，路徑不存在)</h1>');
});

startServer();