# Crowd Blast

Lightweight mobile arcade game (work in progress). See `SPEC.md` and `CLAUDE.md`.
The full README (play on your phone, dev mode) is produced by ticket CON-18.

## Play on your phone (dev mode)

The game is plain static files. `dev.sh` serves them on your local network so a phone on the same Wi-Fi can open them.

**Prerequisites**

- Your computer and your phone are on the same Wi-Fi network, with client isolation disabled.
- Python 3 is installed (`python3 --version`).
- The local firewall allows incoming connections on the port (8000 by default).

**Start the server**

```sh
./dev.sh          # port 8000
./dev.sh 9000     # another port
```

The script prints a phone URL of the form `http://<ip>:<port>/?debug`, a local URL and the engine test page URL. It exits with code 1 if `python3` is missing or the port is already in use. Stop it with Ctrl+C.

On Windows there is no script: run `python -m http.server 8000 --bind 0.0.0.0` from the project folder, then use the URL `http://<ip>:8000/?debug`, where `<ip>` is your computer's address from `ipconfig`.

**Android (Chrome)**

1. Open the phone URL in Chrome.
2. Menu (three dots) > "Add to Home screen". Over plain HTTP on the LAN this is only a shortcut, not an installable PWA.
3. To inspect the page from your computer, enable USB debugging, connect the phone, and open `chrome://inspect` on the computer.

**iPhone (Safari)**

1. Open the phone URL in Safari.
2. Share button > "Add to Home Screen". The game then opens full screen (`apple-mobile-web-app-capable`).
3. To inspect the page, use desktop Safari (Develop menu) with the iPhone connected by USB.

**Stale code on phone**

`python3 -m http.server` sends no `Cache-Control` header, so a phone browser may reuse an older copy of a module after you edit a file, especially when you simply reopen the URL. Opening the URL with `?debug` does not clear that HTTP cache. To force fresh files:

- Android (Chrome): close the Crowd Blast tab, then open Settings > Site settings > Storage (or Settings > Privacy > Clear browsing data) and clear the data for the dev host (`<ip>:<port>`). Reopen the URL.
- iPhone (Safari): Settings > Safari > Advanced > Website Data, remove the dev host, then reopen the URL. With the iPhone plugged in, desktop Safari's Develop menu > Empty Caches also works.
- Any device: a normal reload is often enough when the page is still open, because the browser revalidates its subresources.

**Troubleshooting**

- Page not loading on the phone: check the phone is on the same Wi-Fi, that no VPN is active on either device, and that the firewall allows the port. `127.0.0.1` never works from the phone.
- Guest Wi-Fi networks usually isolate clients: use the main network.
- Old version shown: see "Stale code on phone" below.
- The `?debug` overlay shows FPS (30-frame average), and the run seed, distance, crowd size and speed once the engine feeds them.
- Service workers and PWA installation need HTTPS or `localhost`, so they are not available on the LAN URL. Offline mode is tested on a HTTPS deployment, not on the phone dev URL.
