"use client";

import { CaptchaField, captchaEnabled } from "@/components/captcha-field";
import { Shell } from "@/components/shell";
import { SaveIcon, SettingsIcon, TrashIcon, UploadIcon } from "@/components/icons";
import { apiRequest, assetUrl } from "@/lib/api";
import { useRouter } from "next/navigation";
import { DragEvent, FormEvent, useEffect, useId, useState } from "react";

type ProfileSettings = {
  id: string;
  username: string;
  showGifs?: boolean;
  verified?: boolean;
  email: string;
  name: string;
  bio?: string;
  avatarUrl?: string;
  requiresEmailVerification?: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileSettings | null>(null);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [showGifs, setShowGifs] = useState(true);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [verificationError, setVerificationError] = useState("");
  const [verificationOpen, setVerificationOpen] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [captchaToken, setCaptchaToken] = useState("");
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarInputId = useId();
  const showGifsInputId = useId();

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
      setShowGifs(data.showGifs !== false);
      setError("");
    } catch {
      setError("Login required to access settings.");
    }
  };

  const verifyAccount = async () => {
    setVerificationLoading(true);
    try {
      const result = await apiRequest<{ verified: boolean }>("users/me/verification", {
        method: "POST",
        body: JSON.stringify({ captchaToken }),
      });
      if (result.verified) {
        setProfile((current) => (current ? { ...current, verified: true } : current));
        setVerificationMessage("Account verified. The badge is now attached to your username.");
        setVerificationError("");
        setVerificationOpen(false);
        setCaptchaToken("");
        router.refresh();
      }
    } catch (err) {
      setVerificationMessage("");
      setVerificationError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setVerificationLoading(false);
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
        body: JSON.stringify({ username, email, bio, showGifs }),
      });
      if (updated.requiresEmailVerification) {
        router.push(`/verify-email?email=${encodeURIComponent(updated.email)}&sent=1`);
        router.refresh();
        return;
      }
      setProfile(updated);
      setShowGifs(updated.showGifs !== false);
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
      const updated = await apiRequest<ProfileSettings>("users/me/avatar", {
        method: "POST",
        body: form,
      });
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
      <header className="page-header page-enter">
        <div className="page-header-copy">
          <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight text-slate-100">
            <SettingsIcon size={22} />
            Profile Settings
          </h1>
          <p className="page-lead">
            Account controls live here so profile editing, avatar management, and destructive actions stay separate from the main content flows.
          </p>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)] page-enter">
        <aside className="page-section h-fit space-y-5 lg:sticky lg:top-4">
          <div className="text-center lg:text-left">
            <h3 className="text-xl font-semibold tracking-tight text-slate-100">Profile picture</h3>
            <div className="mx-auto mt-4 h-36 w-36 overflow-hidden rounded-2xl border border-line sm:h-44 sm:w-44 lg:mx-0">
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
              className={`group flex cursor-pointer flex-col items-start gap-3 rounded-2xl border border-dashed bg-bg p-4 transition-all duration-200 sm:flex-row sm:items-center sm:justify-between ${
                isDragOver
                  ? "border-accent bg-accent/10"
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
              <span className="rounded-xl border border-line bg-panel px-3 py-2 text-xs text-slate-300 transition-colors group-hover:border-accent group-hover:text-accent">
                Browse
              </span>
            </label>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                disabled={!avatarFile || uploadingAvatar}
                className="btn-primary w-full sm:w-auto"
              >
                <UploadIcon size={16} />
                {uploadingAvatar ? "Uploading..." : "Upload Avatar"}
              </button>
              {avatarFile ? (
                <button
                  type="button"
                  className="btn-secondary w-full sm:w-auto"
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

        <div className="page-stack">
          <form className="page-section space-y-4" onSubmit={saveProfile}>
            <div>
              <h3 className="section-heading">Account details</h3>
              <p className="section-copy mt-1">Core identity fields appear together so the edit flow reads naturally from top to bottom.</p>
            </div>
            <label className="field-label">
              Username
              <input className="input mt-1" value={username} onChange={(event) => setUsername(event.target.value)} />
            </label>
            <label className="field-label">
              Email
              <input className="input mt-1" value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
            </label>
            <label className="field-label">
              Bio
              <textarea className="input mt-1 min-h-32" value={bio} onChange={(event) => setBio(event.target.value)} />
            </label>

            <label
              htmlFor={showGifsInputId}
              className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-bg/60 px-4 py-4"
            >
              <input
                id={showGifsInputId}
                type="checkbox"
                checked={showGifs}
                onChange={(event) => setShowGifs(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[rgb(var(--accent))]"
              />
              <span className="space-y-1">
                <span className="block text-sm font-medium text-slate-200">Play GIFs automatically</span>
                <span className="block text-xs leading-6 text-slate-500">
                  When disabled, GIFs stay hidden behind a &quot;GIF reaction Show&quot; placeholder until you reveal them.
                </span>
              </span>
            </label>

            <div className="form-actions">
              <div>
                {message ? <p className="text-sm text-success-soft">{message}</p> : null}
                {error ? <p className="text-sm text-danger-soft">{error}</p> : null}
              </div>
              <button className="btn-primary w-full sm:w-auto">
                <SaveIcon size={16} />
                Save changes
              </button>
            </div>
          </form>

          <section className="page-section space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="section-heading">Verification</h3>
                <p className="section-copy mt-1">
                  Verify your account to add a verification mark next to your username across posts, comments, and your profile header.
                </p>
              </div>
              {profile?.verified ? (
                <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-300">Verified</span>
              ) : null}
            </div>

            {profile?.verified ? (
              <div className="subtle-panel text-sm text-slate-300">This account is verified.</div>
            ) : (
              <div className="space-y-4">
                <div className="subtle-panel space-y-2">
                  <p className="text-sm text-slate-300">
                    Verification requires a successful CAPTCHA challenge before the backend will persist your badge.
                  </p>
                  <p className="text-xs leading-6 text-slate-500">
                    Cloudflare Turnstile is used here to make automated verification materially harder.
                  </p>
                </div>

                {!verificationOpen ? (
                  <button
                    type="button"
                    className="btn-secondary w-full sm:w-auto"
                    onClick={() => {
                      setVerificationOpen(true);
                      setVerificationMessage("");
                      setVerificationError("");
                    }}
                  >
                    Start Verification
                  </button>
                ) : (
                  <div className="space-y-4">
                    <CaptchaField onTokenChange={setCaptchaToken} />
                    <div className="action-cluster">
                      <button
                        type="button"
                        className="btn-primary w-full sm:w-auto"
                        disabled={verificationLoading || (captchaEnabled && !captchaToken)}
                        onClick={() => void verifyAccount()}
                      >
                        {verificationLoading ? "Verifying..." : "Verify account"}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary w-full sm:w-auto"
                        onClick={() => {
                          setVerificationOpen(false);
                          setCaptchaToken("");
                          setVerificationMessage("");
                          setVerificationError("");
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                    {captchaEnabled ? (
                      <p className="text-xs text-slate-500">Complete the challenge first, then confirm verification.</p>
                    ) : null}
                  </div>
                )}

                {verificationMessage ? <p className="text-sm text-success-soft">{verificationMessage}</p> : null}
                {verificationError ? <p className="text-sm text-danger-soft">{verificationError}</p> : null}
              </div>
            )}
          </section>

          <section className="page-section space-y-4 border-rose-800/50">
            <div>
              <h3 className="text-xl font-semibold tracking-tight text-danger-soft">Delete account</h3>
            </div>
            <p className="text-sm text-slate-400">Deleting your account removes your profile and related content permanently.</p>
            <label className="field-label">
              Type <span className="font-semibold">DELETE</span> to confirm
              <input className="input mt-1" value={confirmDelete} onChange={(event) => setConfirmDelete(event.target.value)} />
            </label>
            <button
              type="button"
              disabled={deleting}
              className="btn-danger w-full sm:w-auto"
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
