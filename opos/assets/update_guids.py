import json
import uuid
import sys
import os

def update_guids(json_path, backup=True):
    # Comprobar que el archivo existe
    if not os.path.exists(json_path):
        print(f"❌ No se encontró el archivo: {json_path}")
        return

    # Leer el JSON
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        print("❌ El JSON debe ser un array de objetos.")
        return

    # Crear copia de seguridad
    if backup:
        backup_path = json_path + ".bak"
        os.rename(json_path, backup_path)
        print(f"📦 Copia de seguridad creada: {backup_path}")

    # Actualizar los GUID
    for obj in data:
        obj["guid"] = str(uuid.uuid4())

    # Guardar el JSON actualizado
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4, ensure_ascii=False)

    print(f"✅ GUIDs actualizados en {json_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python update_guids.py ruta/al/archivo.json")
    else:
        update_guids(sys.argv[1])
