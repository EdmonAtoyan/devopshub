"use client";

import { Shell } from "@/components/shell";
import { SaveIcon, TrashIcon, UploadIcon, UserCogIcon } from "@/components/icons";
import { apiRequest, apiUrl, assetUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useEffect, useId, useState } from "react";

type ProfileSettings = {
  id: string;
  username: string;
  email: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputId = useId();

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview(null);
      return;
    }

    const objectUrl = URL.createObjectURL(avatarFile);
    setAvatarPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [avatarFile]);

  const load = async () => {
    try {
      const data = await apiRequest<ProfileSettings>("users/me/profile");
      setProfile(data);
      setUsername(data.username || "");
      setEmail(data.email || "");
      setBio(data.bio || "");
      setError("");
    } catch {
      setError("Login required to access settings.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    try {
      const updated = await apiRequest<ProfileSettings>("users/me/profile", {
        method: "PATCH",
        body: JSON.stringify({ username, email, bio }),
      });
      setProfile(updated);
      setMessage("Profile updated.");
      setError("");
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Failed to update profile.");
    }
  };

  const uploadAvatar = async (event: FormEvent) => {
    event.preventDefault();
    if (!avatarFile) {
      setError("Select an image first.");
      return;
    }

    const form = new FormData();
    form.append("avatar", avatarFile);

    setUploadingAvatar(true);
    try {
      const response = await fetch(apiUrl("users/me/avatar"), {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Avatar upload failed.");

      const updated = (await response.json()) as ProfileSettings;
      setProfile(updated);
      setAvatarFile(null);
      setMessage("Profile picture updated.");
      setError("");
    } catch (err) {
      setMessage("");
      setError(err instanceof Error ? err.message : "Avatar upload failed.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const pickAvatarFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setAvatarFile(file);
    setError("");
  };

  const onDropAvatar = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    pickAvatarFile(event.dataTransfer.files?.[0] || null);
  };

  const deleteAccount = async () => {
    if (confirmDelete !== "DELETE") {
      setError('Type DELETE to confirm account removal.');
      return;
    }

    const approved = window.confirm("Delete your account permanently? This action cannot be undone.");
    if (!approved) return;

    setDeleting(true);
    try {
      await apiRequest("users/me/account", { method: "DELETE" });
      await apiRequest("auth/logout", { method: "POST" });
      router.push("/register");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Shell>
      <header className="card p-4 page-enter">
        <h2 className="flex items-center gap-2 text-2xl font-semibold">
          <UserCogIcon size={22} />
          Profile Settings
        </h2>
        <p className="mt-1 text-base text-slate-400">Manage your account information and profile visibility.</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)] page-enter">
        <aside className="card space-y-4 p-4">
          <div>
            <h3 className="text-base font-semibold">Profile Picture</h3>
            <div className="mt-3 h-44 w-44 overflow-hidden rounded-xl border border-line">
              {avatarPreview || profile?.avatarUrl ? (
                <img
                  src={avatarPreview || assetUrl(profile?.avatarUrl || "")}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">No image</div>
              )}
            </div>
          </div>

          <form className="space-y-3" onSubmit={uploadAvatar}>
            <input
              id={avatarInputId}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => pickAvatarFile(event.target.files?.[0] || null)}
            />

            <label
              htmlFor={avatarInputId}
              className={`group flex cursor-pointer items-center justify-between rounded-lg border border-dashed bg-bg p-3 transition-all duration-200 ${
                isDragOver
                  ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(58,184,83,0.25)]"
                  : "border-line hover:border-accent hover:bg-accent/5"
              }`}
              onDragOver={(event) => {
                event.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDropAvatar}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-200">Drag image here or choose file</p>
                <p className="truncate text-xs text-slate-400">
                  {avatarFile ? avatarFile.name : "PNG, JPG, GIF up to 2MB"}
                </p>
              </div>
              <span className="rounded-md border border-line bg-panel px-2 py-1 text-xs text-slate-300 transition-colors group-hover:border-accent group-hover:text-accent">
                Browse
              </span>
            </label>

            <div className="flex items-center gap-2">
              <button
                disabled={!avatarFile || uploadingAvatar}
                className="btn-positive inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UploadIcon size={16} />
                {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
              </button>
              {avatarFile ? (
                <button
                  type="button"
                  className="rounded-lg border border-line px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
                  onClick={() => setAvatarFile(null)}
                >
                  Clear
                </button>
              ) : null}
            </div>

            <p className="text-xs text-slate-500">
              {avatarFile ? "Ready to upload selected image." : "No file selected."}
            </p>
          </form>
        </aside>

        <div className="space-y-4">
          <form className="card space-y-3 p-4" onSubmit={saveProfile}>
            <h3 className="text-base font-semibold">Account</h3>
            <label className="block text-sm text-slate-300">
              Username
              <input className="input mt-1" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="block text-sm text-slate-300">
              Email
              <input className="input mt-1" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>
            <label className="block text-sm text-slate-300">
              Bio
              <textarea className="input mt-1 min-h-28" value={bio} onChange={(event) => setBio(event.target.value)} />
            </label>

            <button className="btn-positive-solid inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold">
              <SaveIcon size={16} />
              Save changes
            </button>
            {message ? <p className="text-sm text-success-soft">{message}</p> : null}
            {error ? <p className="text-sm text-danger-soft">{error}</p> : null}
          </form>

          <section className="card space-y-3 border-rose-800/50 p-4">
            <h3 className="text-base font-semibold text-danger-soft">Danger Zone</h3>
            <p className="text-sm text-slate-400">Deleting your account removes your profile and related content permanently.</p>
            <label className="block text-sm text-slate-300">
              Type <span className="font-semibold">DELETE</span> to confirm
              <input className="input mt-1" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} />
            </label>
            <button
              type="button"
              disabled={deleting}
              className="btn-danger inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-60"
              onClick={() => void deleteAccount()}
            >
              <TrashIcon size={16} />
              {deleting ? "Deleting account..." : "Delete account"}
            </button>
          </section>
        </div>
      </section>
    </Shell>
  );
}
