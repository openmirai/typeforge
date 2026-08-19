# @openmirai/openapi-codegen

Headless TypeScript code generator for OpenAPI / Swagger specs. Produces typed route enums, request-parameter interfaces, and HTTP caller functions for any OpenAPI 2/3 spec.

## Usage

```bash
# Initialize HTTP adapter file
openapi-codegen init --source atlas --client axios
openapi-codegen init --source orbit --client fetch

# Generate types and callers
openapi-codegen generate --source atlas --spec ./swagger.json

# Check for drift without writing files (CI)
openapi-codegen check --source atlas --spec ./swagger.json
```

## Full spec

See the [plan document](https://github.com/openmirai/openmirai-openapi-codegen) for the complete architecture, envelope safety rules, test suite layout, and adoption guide.
