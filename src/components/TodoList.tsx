"use client";

import { useState, useEffect } from "react";

interface Todo {
  id: string;
  task: string;
  completed: boolean;
}

export default function TodoList({ repoId }: { repoId: string }) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTodos = async () => {
    try {
      const res = await fetch(`/api/github/todos?repoId=${repoId}`);
      if (res.ok) {
        const data = await res.json();
        setTodos(data.todos || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTodos();
  }, [repoId]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    try {
      const res = await fetch("/api/github/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repoId, task: newTodo }),
      });
      if (res.ok) {
        setNewTodo("");
        fetchTodos();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTodo = async (id: string, completed: boolean) => {
    try {
      const res = await fetch("/api/github/todos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, completed: !completed }),
      });
      if (res.ok) fetchTodos();
    } catch (err) {
      console.error(err);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/github/todos?id=${id}`, { method: "DELETE" });
      if (res.ok) fetchTodos();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 shadow-xl h-full">
      <h2 className="text-xl font-semibold text-blue-400 mb-6 flex items-center gap-2">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
        Project Roadmap / Todo
      </h2>

      <form onSubmit={addTodo} className="mb-6 flex gap-2">
        <input 
          type="text" 
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-blue-500 outline-none"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
          Add
        </button>
      </form>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {loading ? (
          <div className="text-center py-4 text-gray-600">Loading tasks...</div>
        ) : todos.length === 0 ? (
          <div className="text-center py-4 text-gray-600 italic text-sm">No tasks yet. Plan your next move!</div>
        ) : (
          todos.map(todo => (
            <div key={todo.id} className="flex items-center gap-3 group bg-gray-950/50 p-3 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
              <button 
                onClick={() => toggleTodo(todo.id, todo.completed)}
                className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                  todo.completed ? "bg-green-500 border-green-500 text-white" : "border-gray-600 hover:border-blue-500"
                }`}
              >
                {todo.completed && <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
              </button>
              <span className={`flex-1 text-sm transition-all ${todo.completed ? "text-gray-600 line-through" : "text-gray-300"}`}>
                {todo.task}
              </span>
              <button 
                onClick={() => deleteTodo(todo.id)}
                className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
