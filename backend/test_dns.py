import socket
host = "ep-green-bird-aimdtum7.c-4.us-east-1.aws.neon.tech"
try:
    ip = socket.gethostbyname(host)
    print(f"Success! {host} resolved to {ip}")
except socket.gaierror as e:
    print(f"Failed to resolve {host}: {e}")
