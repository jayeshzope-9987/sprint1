# Hearth Cloud

A small cloud-kitchen app: a storefront for customers, live order tracking, and a kitchen board for staff.

- **Frontend:** plain HTML, CSS and JavaScript in `public/`
- **Backend:** Java 17+ using only the JDK (`com.sun.net.httpserver`), no Maven or Gradle needed
- **Storage:** in memory, so orders reset when the server restarts

## Run in VS Code

1. Install a JDK (17 or newer) and the **Extension Pack for Java** in VS Code.
2. Open this folder (`hearth-cloud`) with **File > Open Folder**.
3. Open `src/Main.java` and click **Run** above `main`, or press F5.
4. Visit http://localhost:8080 for the storefront and http://localhost:8080/kitchen.html for the kitchen board.

Prefer the terminal? From this folder:

```
javac -d out src/Main.java
java -cp out Main
```

Run it from the project folder so the server can find `public/`. To use another port, pass it as an argument, for example `java -cp out Main 9090`.

## API

| Method | Path | What it does |
| --- | --- | --- |
| GET | `/api/menu` | List dishes |
| POST | `/api/orders` | Place an order (form fields: `name`, `phone`, `address`, `items` as `d1:2,d5:1`) |
| GET | `/api/orders` | List all orders |
| GET | `/api/orders/{id}` | Get one order with its current stage |
| POST | `/api/orders/{id}/advance` | Move an order to the next stage |

Orders also advance by themselves every 25 seconds so you can watch the tracker work. Change `AUTO_STEP_MS` in `Main.java` to adjust this.

## Customising

- Dishes and prices: the `MENU` list in `src/Main.java`
- Colours and fonts: the variables at the top of `public/style.css`
- Currency symbol: the `money` function in `public/app.js` and `public/kitchen.html`
