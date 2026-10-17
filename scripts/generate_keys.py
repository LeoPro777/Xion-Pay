import os
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

def generate_rsa_keypair(cert_dir: str = "certs"):
    os.makedirs(cert_dir, exist_ok=True)
    private_key_path = os.path.join(cert_dir, "license_private.pem")
    public_key_path = os.path.join(cert_dir, "license_public.pem")

    if os.path.exists(private_key_path) and os.path.exists(public_key_path):
        print(f"Keys already exist in {cert_dir}.")
        return

    print("Generating 2048-bit RSA key pair for Xion-Pay license signing...")
    private_key = rsa.generate_private_key(
        public_exponent=65537,
        key_size=2048,
    )

    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    public_key = private_key.public_key()
    public_pem = public_key.public_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PublicFormat.SubjectPublicKeyInfo,
    )

    with open(private_key_path, "wb") as f:
        f.write(private_pem)

    with open(public_key_path, "wb") as f:
        f.write(public_pem)

    print(f"Generated RSA keypair:\n - {private_key_path}\n - {public_key_path}")

if __name__ == "__main__":
    generate_rsa_keypair()
