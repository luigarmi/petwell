import { FormEvent, ReactNode, useState } from "react";

export function Panel(props: { title: string; children: ReactNode; eyebrow?: string }) {
  return (
    <section className="panel">
      <header className="panel-header">
        {props.eyebrow ? <span className="panel-eyebrow">{props.eyebrow}</span> : null}
        <h2>{props.title}</h2>
      </header>
      {props.children}
    </section>
  );
}

export function InlineForm(props: {
  title: string;
  fields: Array<{ name: string; placeholder: string; type?: string }>;
  extraField?: ReactNode;
  onSubmit: (data: Record<string, string>) => Promise<void> | void;
  submitLabel?: string;
}) {
  const [busy, setBusy] = useState(false);

  return (
    <form
      className="inline-form"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (busy) {
          return;
        }

        const form = event.currentTarget;
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries()) as Record<string, string>;
        const cleaned = Object.fromEntries(
          Object.entries(data).filter(([, value]) => String(value).trim() !== "")
        ) as Record<string, string>;

        setBusy(true);
        try {
          await props.onSubmit(cleaned);
          form.reset();
        } finally {
          setBusy(false);
        }
      }}
    >
      <h3>{props.title}</h3>
      <div className="field-grid">
        {props.fields.map((field) => (
          <input
            key={field.name}
            name={field.name}
            type={field.type ?? "text"}
            placeholder={field.placeholder}
            required
          />
        ))}
        {props.extraField}
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Guardando..." : props.submitLabel ?? "Guardar"}
      </button>
    </form>
  );
}
