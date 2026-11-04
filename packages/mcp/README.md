# @apw-pdf/mcp

Model Context Protocol (MCP) server exposing `@apw-pdf` to MCP-compatible AI assistants (Claude Desktop, Claude Code, etc.). Lets an assistant list templates, inspect schemas, validate documents, render PDFs, preview pages as PNG, and save custom templates.

## Installation

Run directly via `npx` once published:

```bash
npx -y @apw-pdf/mcp
```

Or install into a project:

```bash
pnpm add @apw-pdf/mcp
```

## Minimal Usage (Claude Desktop / Claude Code Config)

```json
{
  "mcpServers": {
    "apw-pdf": {
      "command": "npx",
      "args": ["-y", "@apw-pdf/mcp"],
      "env": {
        "APW_PDF_OUTPUT_DIR": "D:/pdfs",
        "APW_PDF_TEMPLATE_DIR": "D:/templates"
      }
    }
  }
}
```

- `APW_PDF_OUTPUT_DIR` *(required)*: Directory where `render_pdf` may write output `.pdf` files.
- `APW_PDF_TEMPLATE_DIR` *(optional)*: Directory for custom `.json` templates (required to use `save_template`).

## Exposed Tools

- `describe_schema` — Describe the APW PDF document JSON schema, inline runs, filters, and Thai government document standards.
- `list_templates` — List all built-in and saved templates.
- `get_template` — Get a built-in or saved template definition, its `dataSchema`, and example data.
- `validate_document` — Validate a document or template name against input data.
- `render_pdf` — Render a document or template with data to a PDF file inside `APW_PDF_OUTPUT_DIR`.
- `render_page_png` — Render a specific page of a document or template to PNG (up to 200 DPI) for visual inspection.
- `save_template` — Validate and save a custom JSON template into `APW_PDF_TEMPLATE_DIR`.

## Documentation

See the [main repository README](https://github.com/swd72/apw-pdf-engin#readme) for full documentation.

## License

MIT
