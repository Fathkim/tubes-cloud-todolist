const express  = require('express');
const mysql    = require('mysql2');
const cors     = require('cors');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });
app.use('/uploads', express.static(uploadDir));

function deleteImageFile(imagePath) {
    if (!imagePath) return;
    const filePath = path.join(__dirname, imagePath);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); }
    catch (e) { console.error('Gagal hapus file:', e.message); }
}

let db;
function connectWithRetry(retriesLeft = 10, delay = 5000) {
    db = mysql.createPool({
        host    : process.env.DB_HOST     || 'localhost',
        user    : process.env.DB_USER     || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME     || 'todolist_db',
        port    : process.env.DB_PORT     || 3306,
        waitForConnections: true,
        connectionLimit   : 10,
    });
    db.getConnection((err, connection) => {
        if (err) {
            if (retriesLeft === 0) { console.error('Gagal konek DB.'); process.exit(1); }
            console.warn(`DB belum siap, coba lagi dalam ${delay/1000}s... (sisa ${retriesLeft}x)`);
            db.end(() => {});
            setTimeout(() => connectWithRetry(retriesLeft - 1, delay), delay);
        } else {
            console.log('Terhubung ke MySQL.');
            connection.release();
            startServer();
        }
    });
}

function startServer() {

    app.get('/', (req, res) => {
        res.json({ message: 'Backend To-Do List API berjalan!' });
    });

    app.get('/tasks', (req, res) => {
        db.query('SELECT * FROM tasks ORDER BY id DESC', (err, results) => {
            if (err) return res.status(500).json({ error: 'Gagal mengambil data.' });
            res.json(results);
        });
    });

    app.post('/tasks', upload.single('image'), (req, res) => {
        const { task_name, description, category, priority, due_date } = req.body;
        const image_path = req.file ? `/uploads/${req.file.filename}` : null;
        const sql = 'INSERT INTO tasks (task_name,description,category,priority,due_date,image_path) VALUES (?,?,?,?,?,?)';
        db.query(sql,
            [task_name, description||'', category||'Umum', priority||'Sedang', due_date||null, image_path],
            (err, results) => {
                if (err) { deleteImageFile(image_path); return res.status(500).json({ error: 'Gagal simpan.' }); }
                res.json({ id: results.insertId, message: 'Task added successfully' });
            }
        );
    });

    app.put('/tasks/edit/:id', upload.single('image'), (req, res) => {
        const { task_name, description, category, priority, due_date, remove_image } = req.body;
        const taskId = req.params.id;
        db.query('SELECT image_path FROM tasks WHERE id = ?', [taskId], (err, results) => {
            if (err) return res.status(500).json({ error: 'Gagal ambil data.' });
            if (!results.length) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
            const oldImagePath = results[0].image_path;
            let updateImageSql = '';
            let queryParams = [task_name, description||'', category, priority, due_date||null];
            if (req.file) {
                updateImageSql = ', image_path = ?';
                queryParams.push(`/uploads/${req.file.filename}`);
                deleteImageFile(oldImagePath);
            } else if (remove_image === 'true') {
                updateImageSql = ', image_path = NULL';
                deleteImageFile(oldImagePath);
            }
            queryParams.push(taskId);
            const sql = `UPDATE tasks SET task_name=?,description=?,category=?,priority=?,due_date=?${updateImageSql} WHERE id=?`;
            db.query(sql, queryParams, (err2) => {
                if (err2) return res.status(500).json({ error: 'Gagal update.' });
                res.json({ message: 'Task updated successfully' });
            });
        });
    });

    app.put('/tasks/:id', (req, res) => {
        const { status } = req.body;
        if (!['pending','completed'].includes(status))
            return res.status(400).json({ error: 'Status tidak valid.' });
        db.query('UPDATE tasks SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
            if (err) return res.status(500).json({ error: 'Gagal update status.' });
            res.json({ message: 'Status updated' });
        });
    });

    app.delete('/tasks/:id', (req, res) => {
        db.query('SELECT image_path FROM tasks WHERE id = ?', [req.params.id], (err, results) => {
            if (err) return res.status(500).json({ error: 'Gagal ambil data.' });
            if (!results.length) return res.status(404).json({ error: 'Tugas tidak ditemukan.' });
            const imagePath = results[0].image_path;
            db.query('DELETE FROM tasks WHERE id = ?', [req.params.id], (err2) => {
                if (err2) return res.status(500).json({ error: 'Gagal hapus.' });
                deleteImageFile(imagePath);
                res.json({ message: 'Task deleted' });
            });
        });
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, '0.0.0.0', () => console.log(`✅ Backend running on port ${PORT}`));
}

connectWithRetry();