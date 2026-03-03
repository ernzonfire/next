"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { supabase } from "@/lib/supabase/client";

type UserRow = {
  id: string;
  full_name: string;
  department: string | null;
  employee_id: string | null;
  role: string;
  claimed: boolean;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("profiles")
      .select("id, full_name, department, employee_id, role, claimed")
      .order("full_name", { ascending: true });

    if (loadError) {
      setError(loadError.message);
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Users</h1>
          <p className="card-muted">View user accounts and claim status.</p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Account Management Moved</div>
        <p className="card-muted" style={{ marginTop: 8 }}>
          New and existing employee accounts are now managed through roster uploads only.
        </p>
        <div style={{ marginTop: 14 }}>
          <Link href="/admin/roster" className="btn btn-primary">
            Go to Roster Upload
          </Link>
        </div>
      </div>

      {error ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="helper">{error}</div>
        </div>
      ) : null}

      <div className="table">
        <div className="table-row" style={{ "--columns": 5 } as CSSProperties}>
          <strong>Name</strong>
          <strong>Employee ID</strong>
          <strong>Department</strong>
          <strong>Role</strong>
          <strong>Claimed</strong>
        </div>
        {loading ? (
          <div className="card-muted">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="card-muted">No users found.</div>
        ) : (
          users.map((user) => (
            <div className="table-row" style={{ "--columns": 5 } as CSSProperties} key={user.id}>
              <div>{user.full_name || "Unnamed"}</div>
              <div>{user.employee_id ?? "-"}</div>
              <div>{user.department ?? "-"}</div>
              <div>{user.role}</div>
              <div>{user.claimed ? "Yes" : "No"}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
