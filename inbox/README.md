# inbox/

Carpeta para depositar requerimientos en bruto. El agente `inbox_reader` los procesa
y convierte en features estructuradas.

## Uso

1. Crea un archivo `.md` por proyecto o bloque de requerimientos
2. Usa frontmatter para indicar el scope (opcional):
   ```markdown
   ---
   scope: nombre-proyecto
   ---
   # Requerimientos
   - El sistema debe hacer X
   - Cuando Y, el sistema debe hacer Z
   ```
3. Dile al agente: **"procesa el inbox"**
4. Los archivos procesados se mueven a `inbox/processed/`
