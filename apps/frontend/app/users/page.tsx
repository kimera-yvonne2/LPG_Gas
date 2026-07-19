"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Users, Wrench } from "lucide-react";
import { FormEvent, useState } from "react";

import { Modal, PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { useAuth, type Role, type User } from "@/lib/auth";

type UsersResponse = { results?: User[] } | User[];

const empty = {
  username: "",
  email: "",
  phone_number: "",
  password: "",
  role: "technician" as Role,
};

export default function UsersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const query = useQuery({
    queryKey: ["users"],
    queryFn: async () => (await api.get<UsersResponse>("/users/")).data,
    enabled: user?.role === "admin",
  });
  const create = useMutation({
    mutationFn: async () => (await api.post("/users/", { ...form, is_active: true })).data,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["users"] });
      setForm(empty);
      setOpen(false);
    },
  });

  if (user?.role !== "admin") {
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <ShieldCheck className="mx-auto text-[#073b82]" />
        <h1 className="section-title mt-3">Administrator access required</h1>
        <p className="mt-2 text-xs text-slate-500">
          User provisioning is restricted to LPG Guardian administrators.
        </p>
      </div>
    );
  }

  const users = Array.isArray(query.data) ? query.data : query.data?.results || [];
  const submit = (event: FormEvent) => {
    event.preventDefault();
    create.mutate();
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading
        title="User Management"
        subtitle="Create and manage household, technician, and administrator accounts."
        action={
          <button onClick={() => setOpen(true)} className="btn-primary">
            <Plus size={15} /> Create User
          </button>
        }
      />
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 p-4 text-sm font-extrabold">
          <Users size={17} /> Platform accounts
        </div>
        {query.isLoading ? (
          <div className="p-8 text-center text-sm text-slate-500">Loading users…</div>
        ) : query.isError ? (
          <div className="p-8 text-center text-sm text-red-700">
            Could not load users from the backend.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase text-slate-500">
                <tr>
                  <th className="p-4">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Phone</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map((account) => (
                  <tr key={account.id} className="border-t border-slate-200">
                    <td className="p-4">
                      <strong>{account.username}</strong>
                      <div className="mt-1 text-[10px] text-slate-500">{account.email}</div>
                    </td>
                    <td className="p-4 capitalize">
                      <span className="inline-flex items-center gap-1">
                        {account.role === "technician" && <Wrench size={12} />}
                        {account.role}
                      </span>
                    </td>
                    <td className="p-4">{account.phone_number || "—"}</td>
                    <td className="p-4">
                      <span className={`badge ${account.is_active ? "badge-green" : "badge-red"}`}>
                        {account.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Modal open={open} title="Create Platform User" onClose={() => setOpen(false)}>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Full name"
            value={form.username}
            placeholder="Enter the user's full name"
            onChange={(value) => setForm({ ...form, username: value })}
          />
          <Field
            label="Email address"
            type="email"
            value={form.email}
            placeholder="Enter their email address"
            onChange={(value) => setForm({ ...form, email: value })}
          />
          <Field
            label="Phone number"
            value={form.phone_number}
            placeholder="e.g. +256 700 000 000"
            onChange={(value) => setForm({ ...form, phone_number: value })}
          />
          <Field
            label="Temporary password"
            type="password"
            value={form.password}
            placeholder="Create a secure password"
            onChange={(value) => setForm({ ...form, password: value })}
          />
          <div className="sm:col-span-2">
            <label className="label">Role</label>
            <select
              className="field"
              value={form.role}
              onChange={(event) => setForm({ ...form, role: event.target.value as Role })}
            >
              <option value="technician">Technician</option>
              <option value="admin">Administrator</option>
              <option value="household">Household</option>
            </select>
            <p className="mt-1 text-[10px] text-slate-500">
              Administrator access can create and manage other platform users.
            </p>
          </div>
          {create.isError && (
            <div className="sm:col-span-2 rounded bg-red-50 p-3 text-xs text-red-700">
              The account could not be created. Check for duplicate details and password requirements.
            </div>
          )}
          <div className="sm:col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button disabled={create.isPending} className="btn-primary">
              {create.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function Field({
  label,
  value,
  placeholder,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        required={label !== "Phone number"}
        type={type}
        className="field"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
