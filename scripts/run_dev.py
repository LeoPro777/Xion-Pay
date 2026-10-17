import os
import signal
import subprocess
import sys
import time

ROOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
BACKEND_DIR = os.path.join(ROOT_DIR, "backend")
FRONTEND_DIR = os.path.join(ROOT_DIR, "frontend")
CERTS_DIR = os.path.join(ROOT_DIR, "certs")

# Detect python executable in venv or fallback to sys.executable
VENV_PYTHON = os.path.join(BACKEND_DIR, ".venv", "Scripts", "python.exe")
if not os.path.exists(VENV_PYTHON):
    VENV_PYTHON = sys.executable

def ensure_prerequisites():
    print("=" * 70)
    print("  XION-PAY: Verificando entorno local de desarrollo")
    print("=" * 70)

    # 1. RSA Keys
    priv_key = os.path.join(CERTS_DIR, "license_private.pem")
    pub_key = os.path.join(CERTS_DIR, "license_public.pem")
    if not (os.path.exists(priv_key) and os.path.exists(pub_key)):
        print("[!] Generando par de claves criptográficas RS256...")
        subprocess.run([VENV_PYTHON, os.path.join(ROOT_DIR, "scripts", "generate_keys.py")], check=True)

    # 2. Database seed check
    db_file = os.path.join(ROOT_DIR, "xionpay.db")
    if not os.path.exists(db_file):
        print("[!] Base de datos local inicializando...")
        env = os.environ.copy()
        env["PYTHONPATH"] = "backend"
        subprocess.run([VENV_PYTHON, os.path.join(BACKEND_DIR, "scripts", "seed.py")], env=env, check=True)

    print("[OK] Requisitos previos validados correctamente.\n")

def main():
    ensure_prerequisites()

    backend_env = os.environ.copy()
    backend_env["PYTHONPATH"] = "backend"

    print("[*] Iniciando Backend en http://localhost:8000 (Docs: /docs)...")
    backend_proc = subprocess.Popen(
        [VENV_PYTHON, "-m", "uvicorn", "src.main:app", "--reload", "--host", "0.0.0.0", "--port", "8000"],
        cwd=BACKEND_DIR,
        env=backend_env,
    )

    print("[*] Iniciando Frontend en http://localhost:5173...")
    frontend_proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND_DIR,
        shell=True,
    )

    print("\n" + "=" * 70)
    print("  [LISTO] Xion-Pay corriendo localmente:")
    print("    - Backend:  http://localhost:8000")
    print("    - Swagger:  http://localhost:8000/docs")
    print("    - Frontend: http://localhost:5173")
    print("  Presiona Ctrl + C para detener ambos servicios.")
    print("=" * 70 + "\n")

    try:
        while True:
            time.sleep(1)
            # Check if any child process terminated prematurely
            if backend_proc.poll() is not None:
                print("\n[!] El proceso Backend finalizó inesperadamente.")
                break
            if frontend_proc.poll() is not None:
                print("\n[!] El proceso Frontend finalizó inesperadamente.")
                break
    except KeyboardInterrupt:
        print("\n[*] Deteniendo servicios de Xion-Pay...")
    finally:
        # Gracefully kill processes
        for proc in [backend_proc, frontend_proc]:
            try:
                if proc.poll() is None:
                    if sys.platform == "win32":
                        subprocess.run(["taskkill", "/F", "/T", "/PID", str(proc.pid)], capture_output=True)
                    else:
                        proc.terminate()
            except Exception:
                pass
        print("[OK] Servicios detenidos exitosamente.")

if __name__ == "__main__":
    main()
