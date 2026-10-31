# @apw-pdf/mcp

Model Context Protocol (MCP) server for the APW Thai Government Document PDF Engine.

## Environment Variables

- `APW_PDF_OUTPUT_DIR` (required): Directory where rendered PDFs will be written.
- `APW_PDF_TEMPLATE_DIR` (optional): Directory where custom saved templates (`save_template`) are stored.
- `APW_PDF_ALLOW_REMOTE_IMAGES` (optional): Comma-separated list of allowed remote image hostnames.

## Tools

- `describe_schema`: Get schema documentation, filters, and Thai government standard values.
- `list_templates`: List builtin and saved templates.
- `get_template`: Retrieve a template's document definition, data schema, and example data.
- `validate_document`: Validate document/template and data before rendering.
- `render_pdf`: Render a document or template with data to a PDF file inside `APW_PDF_OUTPUT_DIR`.
- `render_page_png`: Render a specific page to PNG (max 200 DPI) for visual inspection.
- `save_template`: Validate and save a custom JSON template into `APW_PDF_TEMPLATE_DIR`.

## Resources

- `apw-pdf://standards`: Thai government document layout standards (§3).
- `apw-pdf://templates/{name}`: JSON definition for a builtin or saved template.
