import { useState } from 'react'
import type { ScopeMode } from '../domain/slug'

type ConnectionPanelProps = {
  mode: ScopeMode
  slug: string
  token: string
  busy: boolean
  message: string | null
  onMode: (mode: ScopeMode) => void
  onSlug: (slug: string) => void
  onToken: (token: string) => void
  onConnect: () => void
  onClear: () => void
}

export function ConnectionPanel(props: ConnectionPanelProps) {
  return (
    <section className="panel">
      <h2>Connect</h2>
      <p className="muted">
        The token stays in this browser tab (sessionStorage). This site does not send it to any server of its own.
      </p>
      <form
        className="connect"
        onSubmit={(event) => {
          event.preventDefault()
          props.onConnect()
        }}
      >
        <fieldset className="modes">
          <legend>Scope</legend>
          <label>
            <input
              type="radio"
              name="scope"
              checked={props.mode === 'enterprise'}
              onChange={() => props.onMode('enterprise')}
            />
            Enterprise
          </label>
          <label>
            <input type="radio" name="scope" checked={props.mode === 'org'} onChange={() => props.onMode('org')} />
            Organization
          </label>
        </fieldset>
        <label>
          {props.mode === 'enterprise' ? 'Enterprise slug or URL' : 'Organization slug or URL'}
          <input
            value={props.slug}
            onChange={(event) => props.onSlug(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              props.mode === 'enterprise' ? 'https://github.com/enterprises/your-slug' : 'https://github.com/orgs/your-org'
            }
          />
        </label>
        <label>
          Personal access token
          <input
            type="password"
            value={props.token}
            onChange={(event) => props.onToken(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <div className="actions">
          <button type="submit" disabled={props.busy}>
            {props.busy ? 'Connecting…' : 'Connect'}
          </button>
          <button type="button" className="secondary" onClick={props.onClear}>
            Clear
          </button>
        </div>
      </form>
      {props.message && <p className="error">{props.message}</p>}
    </section>
  )
}

type UploadPanelProps = {
  onFiles: (files: File[]) => void
  onPaste: (text: string) => void
}

export function UploadPanel({ onFiles, onPaste }: UploadPanelProps) {
  const [paste, setPaste] = useState('')
  return (
    <section className="panel">
      <h2>Upload a report</h2>
      <p className="muted">
        Drop an NDJSON file from a Copilot usage metrics download link. Paste works when the browser cannot call the API.
      </p>
      <label
        className="drop"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          onFiles([...event.dataTransfer.files])
        }}
      >
        Choose NDJSON or JSON
        <input
          type="file"
          accept=".ndjson,.json,application/x-ndjson,application/json,text/plain"
          multiple
          onChange={(event) => {
            onFiles([...(event.target.files ?? [])])
            event.target.value = ''
          }}
        />
      </label>
      <label>
        Paste report text
        <textarea value={paste} onChange={(event) => setPaste(event.target.value)} rows={5} spellCheck={false} />
      </label>
      <button
        type="button"
        onClick={() => {
          onPaste(paste)
          setPaste('')
        }}
        disabled={!paste.trim()}
      >
        Load pasted report
      </button>
    </section>
  )
}
