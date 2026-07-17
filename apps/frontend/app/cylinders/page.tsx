"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Link2Off, Plus, RefreshCw, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { GasRing } from "@/components/gas-ring";
import { Modal, PageHeading } from "@/components/ui-kit";
import { api } from "@/lib/api";
import { apiErrorMessage } from "@/lib/api-error";
import { useAuth } from "@/lib/auth";
import { ApiList, Cylinder, Household, Sensor, rows } from "@/lib/domain";

const today = () => new Date().toISOString().slice(0, 10);
const emptyCylinder = () => ({
  household: "",
  capacity: "6.000",
  empty_weight: "",
  installation_date: today(),
  status: "active",
});
const emptyReplacement = () => ({
  capacity: "6.000",
  empty_weight: "",
  installation_date: today(),
});
const emptyPairing = () => ({ pairing_code: "", household: "" });

export default function CylindersPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [cylinderOpen, setCylinderOpen] = useState(false);
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [replaceTarget, setReplaceTarget] = useState<Cylinder | null>(null);
  const [connectTarget, setConnectTarget] = useState<Sensor | null>(null);
  const [cylinderForm, setCylinderForm] = useState(emptyCylinder);
  const [replacementForm, setReplacementForm] = useState(emptyReplacement);
  const [pairingForm, setPairingForm] = useState(emptyPairing);
  const [connectCylinder, setConnectCylinder] = useState("");

  const cylindersQuery = useQuery({
    queryKey: ["cylinders"],
    queryFn: async () => (await api.get<ApiList<Cylinder>>("/cylinders/")).data,
    refetchInterval: 10_000,
  });
  const householdsQuery = useQuery({
    queryKey: ["households"],
    queryFn: async () =>
      (await api.get<ApiList<Household>>("/households/")).data,
    enabled: user?.role === "admin",
  });
  const sensorsQuery = useQuery({
    queryKey: ["sensors"],
    queryFn: async () => (await api.get<ApiList<Sensor>>("/sensors/")).data,
    refetchInterval: 10_000,
  });
  const cylinders = rows(cylindersQuery.data);
  const households = rows(householdsQuery.data);
  const sensors = rows(sensorsQuery.data);
  const canManage = user?.role !== "technician";

  const refreshAssets = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["cylinders"] }),
      client.invalidateQueries({ queryKey: ["sensors"] }),
    ]);
  };
  const createCylinder = useMutation({
    mutationFn: async () => {
      const { household, ...data } = cylinderForm;
      const payload =
        user?.role === "admin"
          ? { ...data, household: Number(household) }
          : data;
      return (await api.post("/cylinders/", payload)).data;
    },
    onSuccess: async () => {
      await refreshAssets();
      setCylinderForm(emptyCylinder());
      setCylinderOpen(false);
    },
  });
  const claimDevice = useMutation({
    mutationFn: async () => {
      return (
        await api.post("/devices/claim/", {
          pairing_code: pairingForm.pairing_code,
          ...(user?.role === "admin"
            ? { household: Number(pairingForm.household) }
            : {}),
        })
      ).data;
    },
    onSuccess: async () => {
      await refreshAssets();
      setPairingForm(emptyPairing());
      setDeviceOpen(false);
    },
  });
  const replaceCylinderMutation = useMutation({
    mutationFn: async () =>
      (
        await api.post(
          `/cylinders/${replaceTarget?.id}/replace/`,
          replacementForm,
        )
      ).data,
    onSuccess: async () => {
      await refreshAssets();
      setReplacementForm(emptyReplacement());
      setReplaceTarget(null);
    },
  });
  const connectDevice = useMutation({
    mutationFn: async () =>
      (
        await api.post(`/sensors/${connectTarget?.id}/connect/`, {
          cylinder: Number(connectCylinder),
        })
      ).data,
    onSuccess: async () => {
      await refreshAssets();
      setConnectTarget(null);
      setConnectCylinder("");
    },
  });
  const disconnectDevice = useMutation({
    mutationFn: async (id: number) =>
      (await api.post(`/sensors/${id}/disconnect/`)).data,
    onSuccess: refreshAssets,
  });
  const unpairDevice = useMutation({
    mutationFn: async (id: number) =>
      (await api.post(`/sensors/${id}/unpair/`)).data,
    onSuccess: refreshAssets,
  });
  const removeCylinder = useMutation({
    mutationFn: async (id: number) =>
      (await api.delete(`/cylinders/${id}/`)).data,
    onSuccess: refreshAssets,
  });

  const openDeviceRegistration = () => {
    setPairingForm(emptyPairing());
    claimDevice.reset();
    setDeviceOpen(true);
  };
  const confirmCylinderRemoval = (cylinder: Cylinder) => {
    if (
      window.confirm(
        `Remove cylinder #${cylinder.id}? Its connected device will be disconnected.`,
      )
    )
      removeCylinder.mutate(cylinder.id);
  };
  const confirmDeviceRemoval = (sensor: Sensor) => {
    if (
      window.confirm(
        `Unpair device ${sensor.esp32_id} from this household? Historical readings will be preserved and the device can be paired again.`,
      )
    )
      unpairDevice.mutate(sensor.id);
  };

  return (
    <div className="mx-auto max-w-[1180px]">
      <PageHeading
        title="Cylinders & Devices"
        subtitle="Your device stays with you while cylinders can be replaced."
        action={
          canManage ? (
            <div className="flex gap-2">
              <button
                onClick={() => openDeviceRegistration()}
                className="btn-secondary"
              >
                <Plus size={15} /> Pair Device
              </button>
              <button
                onClick={() => {
                  createCylinder.reset();
                  setCylinderOpen(true);
                }}
                className="btn-primary"
              >
                <Plus size={15} /> Add Cylinder
              </button>
            </div>
          ) : undefined
        }
      />
      <section className="card mb-6 border border-blue-200 bg-blue-50/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="section-title">Device Management</h2>
            <p className="mt-1 text-xs text-slate-600">
              {sensors.length} registered ·{" "}
              {sensors.filter((sensor) => sensor.cylinder).length} connected ·{" "}
              {sensors.filter((sensor) => !sensor.cylinder).length} ready to
              connect
            </p>
          </div>
          {canManage && (
            <button
              className="btn-primary"
              onClick={() => openDeviceRegistration()}
            >
              <Plus size={15} /> Pair New Device
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Datum label="Registered devices" value={String(sensors.length)} />
          <Datum
            label="Connected"
            value={String(sensors.filter((sensor) => sensor.cylinder).length)}
          />
          <Datum
            label="Disconnected"
            value={String(sensors.filter((sensor) => !sensor.cylinder).length)}
          />
        </div>
      </section>
      {cylindersQuery.isLoading ? (
        <Empty text="Loading cylinders…" />
      ) : cylindersQuery.isError ? (
        <Empty text="Cylinders could not be loaded." />
      ) : !cylinders.length ? (
        <Empty text="No active cylinders are registered for this account." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {cylinders.map((cylinder) => {
            const sensor = sensors.find(
              (item) => item.cylinder === cylinder.id,
            );
            return (
              <article key={cylinder.id} className="card p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-extrabold text-[#073b82]">
                      Cylinder #{cylinder.id}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {cylinder.household_name}
                    </div>
                  </div>
                  <span
                    className={`badge ${cylinder.status === "active" ? "badge-green" : "badge-orange"}`}
                  >
                    {cylinder.status}
                  </span>
                </div>
                <div className="mt-5 grid items-center gap-5 sm:grid-cols-[150px_1fr]">
                  <GasRing
                    value={Math.round(Number(cylinder.latest_gas_percentage ?? 0))}
                    size={145}
                  />
                  <div>
                    <dl className="grid grid-cols-2 gap-3 text-xs">
                      <Datum
                        label="Capacity"
                        value={`${cylinder.capacity} kg`}
                      />
                      <Datum
                        label="Current weight"
                        value={cylinder.latest_weight ? `${cylinder.latest_weight} kg` : "Waiting for device"}
                      />
                      <Datum
                        label="Installed"
                        value={new Date(
                          cylinder.installation_date,
                        ).toLocaleDateString()}
                      />
                      <Datum
                        label="Device"
                        value={sensor ? sensor.esp32_id : "Not connected"}
                      />
                    </dl>
                    {canManage && (
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {!sensor && (
                          <button
                            className="btn-secondary"
                            onClick={() => openDeviceRegistration()}
                          >
                            <Link2 size={14} /> Add Device
                          </button>
                        )}
                        <button
                          className="btn-secondary"
                          onClick={() => {
                            setReplacementForm(emptyReplacement());
                            setReplaceTarget(cylinder);
                          }}
                        >
                          <RefreshCw size={14} /> Replace
                        </button>
                        <button
                          className="btn-secondary text-red-700"
                          onClick={() => confirmCylinderRemoval(cylinder)}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <section className="mt-6">
        <h2 className="section-title mb-3">Monitoring Devices</h2>
        {sensorsQuery.isLoading ? (
          <Empty text="Loading devices…" />
        ) : !sensors.length ? (
          <Empty text="No monitoring devices are paired." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {sensors.map((sensor) => (
              <article className="card p-4" key={sensor.id}>
                <div className="flex justify-between gap-3">
                  <div>
                    <strong className="text-sm text-[#073b82]">
                      {sensor.esp32_id}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {sensor.cylinder
                        ? `Connected to cylinder #${sensor.cylinder}`
                        : "Disconnected and ready to connect"}
                    </p>
                  </div>
                  <span
                    className={`badge ${sensor.online_status ? "badge-green" : "badge-orange"}`}
                  >
                    {sensor.online_status ? "online" : "offline"}
                  </span>
                </div>
                {canManage && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sensor.cylinder ? (
                      <button
                        className="btn-secondary"
                        onClick={() => disconnectDevice.mutate(sensor.id)}
                      >
                        <Link2Off size={14} /> Disconnect
                      </button>
                    ) : (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          setConnectCylinder("");
                          setConnectTarget(sensor);
                        }}
                      >
                        <Link2 size={14} /> Connect
                      </button>
                    )}
                    <button
                      className="btn-secondary text-red-700"
                      onClick={() => confirmDeviceRemoval(sensor)}
                    >
                      <Trash2 size={14} /> Unpair Device
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      <Modal
        open={cylinderOpen}
        title="Register Cylinder"
        onClose={() => setCylinderOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            createCylinder.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {user?.role === "admin" && (
            <div className="sm:col-span-2">
              <label className="label">Household</label>
              <select
                required
                className="field"
                value={cylinderForm.household}
                onChange={(event) =>
                  setCylinderForm({
                    ...cylinderForm,
                    household: event.target.value,
                  })
                }
              >
                <option value="">Select household</option>
                {households.map((household) => (
                  <option key={household.id} value={household.id}>
                    {household.owner_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <CylinderFields form={cylinderForm} setForm={setCylinderForm} />
          {createCylinder.isError && (
            <ErrorText
              error={createCylinder.error}
              fallback="The cylinder could not be registered."
            />
          )}
          <ModalButtons
            busy={createCylinder.isPending}
            label="Register"
            onCancel={() => setCylinderOpen(false)}
          />
        </form>
      </Modal>
      <Modal
        open={deviceOpen}
        title="Pair Monitoring Device"
        onClose={() => setDeviceOpen(false)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            claimDevice.mutate();
          }}
          className="grid gap-4"
        >
          <p className="text-sm text-slate-600">
            Turn on the LPG Guardian, connect it to Wi-Fi, then enter the
            six-digit pairing code shown on its OLED.
          </p>
          {user?.role === "admin" && (
          <div>
            <label className="label">Household</label>
            <select
              required
              className="field"
              value={pairingForm.household}
              onChange={(event) =>
                setPairingForm({ ...pairingForm, household: event.target.value })
              }
            >
              <option value="">Select household</option>
              {households.map((household) => (
                <option key={household.id} value={household.id}>
                  {household.owner_name}
                </option>
              ))}
            </select>
          </div>
          )}
          <div>
            <label className="label">Pairing code</label>
            <input
              required
              className="field font-mono tracking-[0.35em]"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]{6}"
              placeholder="000000"
              value={pairingForm.pairing_code}
              onChange={(event) =>
                setPairingForm({
                  ...pairingForm,
                  pairing_code: event.target.value.replace(/\D/g, "").slice(0, 6),
                })
              }
            />
          </div>
          {claimDevice.isError && (
            <ErrorText
              error={claimDevice.error}
              fallback="The device could not be paired. Check that the code has not expired."
            />
          )}
          <ModalButtons
            busy={claimDevice.isPending}
            label="Pair Device"
            onCancel={() => setDeviceOpen(false)}
          />
        </form>
      </Modal>
      <Modal
        open={Boolean(replaceTarget)}
        title="Replace Cylinder"
        onClose={() => setReplaceTarget(null)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            replaceCylinderMutation.mutate();
          }}
          className="grid gap-4 sm:grid-cols-2"
        >
          <p className="sm:col-span-2 text-xs text-slate-600">
            The old cylinder will be retired and its device will move to the
            replacement.
          </p>
          <CylinderFields form={replacementForm} setForm={setReplacementForm} />
          {replaceCylinderMutation.isError && (
            <ErrorText
              error={replaceCylinderMutation.error}
              fallback="The cylinder could not be replaced."
            />
          )}
          <ModalButtons
            busy={replaceCylinderMutation.isPending}
            label="Replace Cylinder"
            onCancel={() => setReplaceTarget(null)}
          />
        </form>
      </Modal>
      <Modal
        open={Boolean(connectTarget)}
        title="Connect Device"
        onClose={() => setConnectTarget(null)}
      >
        <form
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            connectDevice.mutate();
          }}
          className="grid gap-4"
        >
          <p className="text-xs text-slate-600">
            Choose the cylinder currently measured by{" "}
            <strong>{connectTarget?.esp32_id}</strong>.
          </p>
          <select
            required
            className="field"
            value={connectCylinder}
            onChange={(event) => setConnectCylinder(event.target.value)}
          >
            <option value="">Select cylinder</option>
            {cylinders
              .filter(
                (cylinder) =>
                  !sensors.some((sensor) => sensor.cylinder === cylinder.id),
              )
              .map((cylinder) => (
                <option key={cylinder.id} value={cylinder.id}>
                  Cylinder #{cylinder.id} ({Number(cylinder.capacity)} kg)
                </option>
              ))}
          </select>
          <ModalButtons
            busy={connectDevice.isPending}
            label="Connect Device"
            onCancel={() => setConnectTarget(null)}
          />
        </form>
      </Modal>
    </div>
  );
}

function CylinderFields<T extends Record<string, string>>({
  form,
  setForm,
}: {
  form: T;
  setForm: (value: T) => void;
}) {
  return (
    <>
      <div>
        <label className="label">Capacity</label>
        <select
          required
          className="field"
          value={form.capacity}
          onChange={(event) =>
            setForm({ ...form, capacity: event.target.value })
          }
        >
          <option value="3.000">3 kg</option>
          <option value="6.000">6 kg</option>
        </select>
      </div>
      <div>
        <label className="label">Tare weight (empty cylinder)</label>
        <input
          required
          className="field"
          type="number"
          min="0"
          step="0.001"
          value={form.empty_weight}
          onChange={(event) =>
            setForm({ ...form, empty_weight: event.target.value })
          }
        />
        {form.empty_weight && (
          <p className="mt-1 text-xs text-slate-500">
            Full cylinder weight: {(
              Number(form.empty_weight) + Number(form.capacity)
            ).toFixed(3)} kg
          </p>
        )}
      </div>
      <div>
        <label className="label">Installation date</label>
        <input
          required
          className="field"
          type="date"
          value={form.installation_date}
          onChange={(event) =>
            setForm({ ...form, installation_date: event.target.value })
          }
        />
      </div>
    </>
  );
}
function ModalButtons({
  busy,
  label,
  onCancel,
}: {
  busy: boolean;
  label: string;
  onCancel: () => void;
}) {
  return (
    <div className="sm:col-span-2 flex justify-end gap-2">
      <button type="button" className="btn-secondary" onClick={onCancel}>
        Cancel
      </button>
      <button disabled={busy} className="btn-primary">
        {busy ? "Saving…" : label}
      </button>
    </div>
  );
}
function ErrorText({ error, fallback }: { error: unknown; fallback: string }) {
  return (
    <p className="sm:col-span-2 text-xs text-red-700">
      {apiErrorMessage(
        (error as { response?: { data?: unknown } } | null)?.response?.data,
        fallback,
      )}
    </p>
  );
}
function Datum({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-slate-50 p-3">
      <dt className="text-[9px] font-bold uppercase text-slate-500">{label}</dt>
      <dd className="mt-1 font-bold">{value}</dd>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="card grid min-h-40 place-items-center p-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
