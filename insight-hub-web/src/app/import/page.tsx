import { UploadForm } from "./upload-form";

export default function ImportPage() {
  return (
    <main>
      <div className="card">
        <span className="kicker">Import</span>
        <h1>Importer un CSV</h1>
        <p className="subtitle">
          Ajoutez un fichier de messages et filtrez-les par mot-clé pour lancer l&apos;analyse.
        </p>
        <UploadForm />
      </div>
    </main>
  );
}
