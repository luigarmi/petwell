import { FormEvent, ReactNode } from "react";

export function Panel(props: { title: string; children: ReactNode }) {
  return (
    <section className="panel">
      <header className="panel-header">
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
  onSubmit: (data: Record<string, string>) => void;
}) {
  return (
    <form
      className="inline-form"
      onSubmit={(event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const data = Object.fromEntries(formData.entries()) as Record<string, string>;
        const cleaned = Object.fromEntries(
          Object.entries(data).filter(([, value]) => String(value).trim() !== "")
        ) as Record<string, string>;
        props.onSubmit(cleaned);
        event.currentTarget.reset();
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
      <button type="submit">Guardar</button>
    </form>
  );
}
