'use client';

import { useState } from 'react';
import { Semester } from '@/lib/types';
import { generateId } from '@/lib/utils';

interface SemesterManagerProps {
  semesters: Semester[];
  activeSemesterId: string;
  onSwitch: (id: string) => void;
  onAdd: (semester: Semester) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

export default function SemesterManager({
  semesters,
  activeSemesterId,
  onSwitch,
  onAdd,
  onRename,
  onDelete,
}: SemesterManagerProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  function handleAdd() {
    if (!newName.trim()) return;
    onAdd({ id: generateId(), name: newName.trim(), courses: [] });
    setNewName('');
    setShowAdd(false);
  }

  function handleRename(id: string) {
    if (!editName.trim()) return;
    onRename(id, editName.trim());
    setEditingId(null);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {semesters.map(sem => (
        <div key={sem.id} className="flex items-center">
          {editingId === sem.id ? (
            <form
              onSubmit={e => { e.preventDefault(); handleRename(sem.id); }}
              className="flex gap-1"
            >
              <input
                autoFocus
                type="text"
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="text-sm px-2 py-1 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none w-32"
                onBlur={() => setEditingId(null)}
              />
              <button type="submit" className="text-xs text-blue-600 dark:text-blue-400 px-1">Save</button>
            </form>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onSwitch(sem.id)}
                className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-all ${
                  sem.id === activeSemesterId
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {sem.name}
                <span className="ml-1.5 opacity-70 text-xs">({sem.courses.length})</span>
              </button>
              {sem.id === activeSemesterId && (
                <div className="flex gap-0.5">
                  <button
                    onClick={() => { setEditingId(sem.id); setEditName(sem.name); }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded text-xs"
                    title="Rename"
                  >
                    ✏️
                  </button>
                  {semesters.length > 1 && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${sem.name}"?`)) onDelete(sem.id);
                      }}
                      className="text-gray-400 hover:text-red-500 p-1 rounded text-xs"
                      title="Delete semester"
                    >
                      🗑️
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {showAdd ? (
        <form onSubmit={e => { e.preventDefault(); handleAdd(); }} className="flex gap-1">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="e.g. Fall 2026"
            className="text-sm px-2 py-1.5 rounded-lg border border-blue-400 dark:border-blue-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none w-36"
            onBlur={() => { if (!newName) setShowAdd(false); }}
          />
          <button
            type="submit"
            className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
          >
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(false)}
            className="text-sm px-2 py-1.5 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            &times;
          </button>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="text-sm px-3 py-1.5 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors font-medium"
        >
          + New Semester
        </button>
      )}
    </div>
  );
}
