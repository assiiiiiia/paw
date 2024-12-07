import express from 'express';
import db from './db.js';

const router = express.Router();

// Ensure all paths include `/api`
const apiBasePath = '/api';

// Middleware to prefix all routes with `/api`
router.use(apiBasePath, (req, res, next) => {
  next();
});

// Get the number of tasks due today
router.get('/tasks/today', (req, res) => {
  const query = `
    SELECT COUNT(*) AS taskCount
    FROM tasks
    WHERE DATE(due_date) = CURDATE() 
      AND (status = 'pas commencé' OR status = 'en cours')
  `;

  db.query(query, (err, results) => { 
    if (err) {
      console.error('Error fetching tasks due today:', err);
      return res.status(500).send('Server Error');
    }
    res.json({ taskCount: results[0].taskCount });
  });
});

//get all the tasks of today
router.get('/tasks', (req, res) => {
  const query = `
    SELECT * 
    FROM tasks
    WHERE DATE(due_date) = CURDATE()  -- This ensures only tasks for today are selected
      AND (status = 'pas commence' OR status = 'en cours' OR status = 'annule')
    ORDER BY FIELD(priority, 'urgent', 'important', 'moins important')
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching tasks:', err);
      return res.status(500).send('Server Error');
    }
    res.json(results); 
  });
});



// API endpoint to fetch tasks grouped by status
router.get('/tasks-by-status', (req, res) => {
  const query = `
    SELECT * 
    FROM tasks
    ORDER BY FIELD(status, 'pas commence', 'en cours', 'termine')`;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Erreur lors de la récupération des tâches :", err);
      return res.status(500).json({ error: "Erreur serveur" });
    }

    const groupedTasks = {
      "pas commence": [],
      "en cours": [],
      "termine": [],
    };

    results.forEach((task) => {
      if (groupedTasks[task.status]) {
        groupedTasks[task.status].push(task);
      }
    });

    res.json(groupedTasks);
  });
});
router.post('/tasks-add', (req, res) => {
  const { task_name, category, due_date, priority } = req.body;
  console.log('Route /tasks-add appelée avec les données :', req.body);

  // Validation de la priorité
  const validPriorities = ['moins important', 'important', 'urgent'];
  if (!validPriorities.includes(priority)) {
    return res.status(400).json({ message: "Priorité invalide." });
  }

  // Récupérer la date actuelle sans l'heure
  const currentDate = new Date();
  const currentDateOnly = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

  // Comparer uniquement la date, sans tenir compte de l'heure
  let dueDateObj;
  if (due_date) {
    dueDateObj = new Date(due_date); // Convertir la date
    const dueDateOnly = new Date(dueDateObj.getFullYear(), dueDateObj.getMonth(), dueDateObj.getDate());

    if (dueDateOnly < currentDateOnly) {
      return res.status(400).json({ message: "La date d'échéance ne peut pas être dans le passé." });
    }
  }

  // Insertion dans la base de données
  const query = `INSERT INTO tasks (task_name, category, due_date, priority) VALUES (?, ?, ?, ?)`;
  const values = [task_name, category, due_date, priority];

  db.query(query, values, (err, result) => {
    if (err) {
      console.error("Error inserting task:", err);
      return res.status(500).json({ message: "Erreur lors de l'insertion de la tâche." });
    }
    res.json({ message: "Tâche insérée avec succès !" });
  });
});
//route pour modifier les informations d'une tache
router.put('/tasks/:id', (req, res) => {
  const taskId = req.params.id;
  const { task_name, category, due_date, due_time, priority, status } = req.body;

  if (!taskId) {
    return res.status(400).json({ message: 'Task ID is required.' });
  }

  const updates = [];
  const values = [];

  if (task_name) {
    updates.push('task_name = ?');
    values.push(task_name);
  }
  if (category) {
    updates.push('category = ?');
    values.push(category);
  }
  if (due_date) {
    const dueDateTime = due_time ? `${due_date} ${due_time}` : `${due_date} 00:00:00`;
    updates.push('due_date = ?');
    values.push(dueDateTime);
  }
  if (priority) {
    updates.push('priority = ?');
    values.push(priority);
  }
  if (status) {
    updates.push('status = ?');
    values.push(status); // Update status to 'terminé' or current status
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No data to update.' });
  }

  const updateQuery = `
    UPDATE tasks 
    SET ${updates.join(', ')} 
    WHERE id = ?;
  `;
  values.push(taskId);

  console.log("SQL Query:", updateQuery);
  console.log("SQL Values:", values);

  db.query(updateQuery, values, (err, result) => {
    if (err) {
      console.error('Error updating task:', err);
      return res.status(500).json({ message: 'Internal error while updating task.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Task not found.' });
    }

    res.json({ message: 'Task updated successfully!' });
  });
});

// Endpoint to get completed tasks
router.get('/history', (req, res) => {
  const query = 'SELECT * FROM tasks WHERE status = "termine"';
  
  db.query(query, (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).send('Error fetching tasks');
    } else {
      res.json(results);
    }
  });
});

export default router;
