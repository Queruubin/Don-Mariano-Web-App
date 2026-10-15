import { CircleCheck, Download, FileSpreadsheet } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import { Modal } from '../../shared/components/Modal';
import { apiErrorMessage, parseApiError } from '../../shared/utils/apiErrors';
import { saveBlob } from '../../shared/utils/download';
import { useApplyImport, usePreviewImport } from '../hooks/useCatalog';
import { importableCount, productsLabel } from '../importSummary';
import { catalogService } from '../services/catalogService';
import { ImportPreview } from './ImportPreview';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

type Step = 'pick' | 'preview' | 'done';

/** Client-side checks so obvious mistakes get an answer before uploading. */
function checkFile(file: File): string | null {
  if (!file.name.toLowerCase().endsWith('.xlsx')) {
    return 'Ese archivo no es de Excel (.xlsx). Use la plantilla o guarde su archivo como "Libro de Excel".';
  }
  if (file.size > MAX_FILE_BYTES) return 'El archivo es muy grande. El máximo es 2 MB.';
  return null;
}

function errorText(error: unknown): string {
  const { fields, message } = parseApiError(error);
  return fields.file ?? message ?? apiErrorMessage(error);
}

function StepTitle({ number, children }: { number: number; children: string }) {
  return (
    <p className="mb-3 text-text-muted">
      <span className="font-bold">Paso {number} de 3:</span> {children}
    </p>
  );
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const preview = usePreviewImport();
  const apply = useApplyImport();

  const downloadTemplate = async () => {
    setTemplateError(null);
    setDownloading(true);
    try {
      saveBlob(await catalogService.downloadTemplate(), 'plantilla_productos.xlsx');
    } catch (error) {
      setTemplateError(apiErrorMessage(error));
    } finally {
      setDownloading(false);
    }
  };

  const onFileChosen = (event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    // Allow picking the same file again after fixing it in Excel.
    event.target.value = '';
    if (!chosen) return;
    setFile(chosen);
    preview.reset();
    apply.reset();
    const problem = checkFile(chosen);
    setFileError(problem);
    if (problem) return;
    preview.mutate(chosen, { onSuccess: () => setStep('preview') });
  };

  const chooseAnother = () => {
    setStep('pick');
    setFile(null);
    preview.reset();
    apply.reset();
  };

  const count = preview.data ? importableCount(preview.data) : 0;

  if (step === 'done' && apply.data) {
    const { counts } = apply.data;
    return (
      <Modal
        title="Importar desde Excel"
        onClose={onClose}
        footer={
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Listo
          </button>
        }
      >
        <StepTitle number={3}>¡Listo!</StepTitle>
        <div role="status" className="flex flex-col items-center gap-3 py-4 text-center">
          <CircleCheck aria-hidden="true" className="size-14 text-primary" />
          <p className="font-display text-2xl font-bold">El catálogo quedó actualizado</p>
          <ul className="space-y-1 text-lg">
            <li>Productos nuevos: {counts.created}</li>
            <li>
              Productos actualizados: {counts.updated}
              {counts.reactivated > 0 && ` (${counts.reactivated} se volvieron a activar)`}
            </li>
            {counts.unchanged > 0 && <li>Sin cambios: {counts.unchanged}</li>}
            {counts.invalid > 0 && (
              <li className="font-semibold text-danger">
                Filas con errores que no se importaron: {counts.invalid}
              </li>
            )}
          </ul>
        </div>
      </Modal>
    );
  }

  if (step === 'preview' && preview.data) {
    return (
      <Modal
        title="Importar desde Excel"
        size="lg"
        onClose={onClose}
        footer={
          <>
            <button type="button" className="btn btn-ghost" onClick={chooseAnother} disabled={apply.isPending}>
              Elegir otro archivo
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={count === 0 || apply.isPending || !file}
              onClick={() => file && apply.mutate(file, { onSuccess: () => setStep('done') })}
            >
              {apply.isPending
                ? 'Importando…'
                : count === 0
                  ? 'No hay nada que importar'
                  : `Importar ${productsLabel(count)}`}
            </button>
          </>
        }
      >
        <StepTitle number={2}>revise los cambios antes de importar.</StepTitle>
        {file && (
          <p className="mb-3 flex items-center gap-2 font-semibold">
            <FileSpreadsheet aria-hidden="true" className="size-5 text-primary" />
            {file.name}
          </p>
        )}
        {count === 0 && (
          <p className="mb-3 rounded-2xl bg-accent-soft p-3 font-semibold">
            Todos los productos válidos ya están iguales en el catálogo. No hay nada que importar.
          </p>
        )}
        {apply.error && (
          <p role="alert" className="mb-3 rounded-2xl bg-danger-soft p-3 font-semibold text-danger">
            {errorText(apply.error)}
          </p>
        )}
        <ImportPreview preview={preview.data} />
      </Modal>
    );
  }

  const uploadError = fileError ?? (preview.error ? errorText(preview.error) : null);

  return (
    <Modal
      title="Importar desde Excel"
      onClose={onClose}
      footer={
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Cancelar
        </button>
      }
    >
      <StepTitle number={1}>prepare y elija su archivo.</StepTitle>
      <ol className="mb-5 list-decimal space-y-2 pl-6 text-lg">
        <li>Descargue la plantilla y escriba un producto por fila: nombre, unidad y categoría.</li>
        <li>Guarde el archivo y elíjalo aquí. Antes de guardar nada le mostramos qué va a cambiar.</li>
      </ol>

      <div className="flex flex-col gap-3">
        <button type="button" className="btn btn-secondary" onClick={downloadTemplate} disabled={downloading}>
          <Download aria-hidden="true" className="size-5" />
          {downloading ? 'Descargando…' : 'Descargar plantilla'}
        </button>
        {templateError && <p className="field-error">{templateError}</p>}

        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={onFileChosen}
          disabled={preview.isPending}
        />
        <button
          type="button"
          className="btn btn-primary min-h-20 text-lg"
          onClick={() => inputRef.current?.click()}
          disabled={preview.isPending}
          aria-describedby={uploadError ? `${inputId}-error` : undefined}
        >
          <FileSpreadsheet aria-hidden="true" className="size-6" />
          {preview.isPending ? 'Revisando el archivo…' : 'Elegir archivo de Excel'}
        </button>
        {file && !preview.isPending && <p className="text-center text-text-muted">Archivo: {file.name}</p>}
        {uploadError && (
          <p id={`${inputId}-error`} role="alert" className="rounded-2xl bg-danger-soft p-3 font-semibold text-danger">
            {uploadError}
          </p>
        )}
      </div>
    </Modal>
  );
}
