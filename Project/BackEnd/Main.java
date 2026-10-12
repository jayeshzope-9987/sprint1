import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;

/** Hearth Cloud: a tiny cloud-kitchen server. No libraries, just the JDK (17+). */
public class Main {

    record Dish(String id, String name, String category, String desc, int price, int mins, boolean veg) {}

    static class Order {
        int id, total, stage;
        String name, phone, address;
        Map<String, Integer> items = new LinkedHashMap<>();
        long placed = System.currentTimeMillis();
    }

    static final String[] STAGES = {"Received", "Preparing", "Out for delivery", "Delivered"};
    static final long AUTO_STEP_MS = 25_000; // demo: orders move forward on their own every 25s
    static final Path WEB = Path.of("public").toAbsolutePath().normalize();
    static final AtomicInteger NEXT_ID = new AtomicInteger(1001);
    static final Map<Integer, Order> ORDERS = new ConcurrentHashMap<>();

    static final List<Dish> MENU = List.of(
        // South Indian
        new Dish("s1", "Masala dosa", "South Indian", "Crisp fermented crepe, spiced potato, coconut chutney and sambar.", 149, 15, true),
        new Dish("s2", "Idli sambar", "South Indian", "Four soft steamed idlis with sambar and three chutneys.", 109, 10, true),
        new Dish("s3", "Medu vada", "South Indian", "Two crisp lentil doughnuts, hot sambar on the side.", 99, 12, true),
        new Dish("s4", "Appam with veg stew", "South Indian", "Lacy rice hoppers with a mild coconut-milk vegetable stew.", 189, 20, true),
        new Dish("s5", "Chettinad chicken curry", "South Indian", "Black pepper and fennel curry, served with flaky parotta.", 299, 30, false),
        new Dish("s6", "Hyderabadi dum biryani", "South Indian", "Sealed-pot chicken biryani with raita and mirchi ka salan.", 329, 35, false),
        new Dish("s7", "Curd rice", "South Indian", "Tempered yoghurt rice with pomegranate and mango pickle.", 119, 8, true),
        new Dish("s8", "Filter coffee", "South Indian", "Strong decoction coffee, frothed with hot milk.", 79, 5, true),
        new Dish("s9", "Palada payasam", "South Indian", "Rice flakes slow-cooked in sweet milk with cardamom.", 109, 5, true),
        // North Indian
        new Dish("n1", "Butter chicken with naan", "North Indian", "Charred chicken in tomato-butter gravy, with buttered naan.", 319, 28, false),
        new Dish("n2", "Paneer butter masala", "North Indian", "Soft paneer in a rich cashew-tomato gravy, with naan.", 279, 25, true),
        new Dish("n3", "Dal makhani and jeera rice", "North Indian", "Black lentils simmered overnight, finished with cream.", 219, 20, true),
        new Dish("n4", "Chole bhature", "North Indian", "Spiced chickpeas with two puffed, golden bhature.", 169, 18, true),
        new Dish("n5", "Rajma chawal", "North Indian", "Kidney bean curry over steamed basmati rice.", 179, 18, true),
        new Dish("n6", "Chicken seekh kebab", "North Indian", "Minced chicken skewers from the tandoor, mint chutney.", 289, 25, false),
        new Dish("n7", "Aloo paratha with curd", "North Indian", "Stuffed whole-wheat paratha with white butter and curd.", 129, 15, true),
        new Dish("n8", "Mutton rogan josh", "North Indian", "Slow-cooked Kashmiri mutton curry with steamed rice.", 389, 40, false),
        new Dish("n9", "Gulab jamun", "North Indian", "Four warm jamuns in cardamom syrup.", 129, 10, true),
        new Dish("n10", "Sweet lassi", "North Indian", "Thick chilled yoghurt drink with saffron and pistachio.", 99, 5, true)
    );

    public static void main(String[] args) throws Exception {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api/", Main::api);
        server.createContext("/", Main::files);
        server.start();
        System.out.println("Hearth Cloud is running at http://localhost:" + port);
    }

    // ---------- API ----------

    static void api(HttpExchange x) throws IOException {
        try {
            String m = x.getRequestMethod(), p = x.getRequestURI().getPath();
            if (m.equals("GET") && p.equals("/api/menu")) {
                send(x, 200, "[" + MENU.stream().map(Main::json).collect(Collectors.joining(",")) + "]");
            } else if (m.equals("GET") && p.equals("/api/orders")) {
                send(x, 200, "[" + ORDERS.values().stream()
                    .sorted(Comparator.comparingInt((Order o) -> o.id).reversed())
                    .map(Main::json).collect(Collectors.joining(",")) + "]");
            } else if (m.equals("POST") && p.equals("/api/orders")) {
                createOrder(x);
            } else if (m.equals("GET") && p.matches("/api/orders/\\d+")) {
                Order o = ORDERS.get(Integer.parseInt(p.substring(12)));
                if (o == null) send(x, 404, error("Order not found")); else send(x, 200, json(o));
            } else if (m.equals("POST") && p.matches("/api/orders/\\d+/advance")) {
                Order o = ORDERS.get(Integer.parseInt(p.split("/")[3]));
                if (o == null) { send(x, 404, error("Order not found")); return; }
                o.stage = Math.min(STAGES.length - 1, stageOf(o) + 1);
                send(x, 200, json(o));
            } else {
                send(x, 404, error("Not found"));
            }
        } catch (Exception e) {
            send(x, 500, error("Something went wrong on the server"));
        }
    }

    static void createOrder(HttpExchange x) throws IOException {
        Map<String, String> f = form(new String(x.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
        String name = f.getOrDefault("name", "").trim(), phone = f.getOrDefault("phone", "").trim(),
               address = f.getOrDefault("address", "").trim();
        if (name.isEmpty() || address.isEmpty() || !phone.matches("[0-9+ ]{7,15}")) {
            send(x, 400, error("Enter your name, a valid phone number and a delivery address"));
            return;
        }
        Order o = new Order();
        o.name = name; o.phone = phone; o.address = address;
        for (String pair : f.getOrDefault("items", "").split(",")) {
            String[] kv = pair.split(":");
            if (kv.length != 2) continue;
            Dish d = MENU.stream().filter(m -> m.id().equals(kv[0])).findFirst().orElse(null);
            int qty = Integer.parseInt(kv[1]);
            if (d == null || qty < 1 || qty > 20) continue;
            o.items.merge(d.name(), qty, Integer::sum);
            o.total += d.price() * qty;
        }
        if (o.items.isEmpty()) { send(x, 400, error("Your basket is empty")); return; }
        o.id = NEXT_ID.getAndIncrement();
        ORDERS.put(o.id, o);
        send(x, 201, json(o));
    }

    /** The stage is the later of the kitchen's manual step and the timed demo progress. */
    static int stageOf(Order o) {
        int timed = (int) Math.min(STAGES.length - 1, (System.currentTimeMillis() - o.placed) / AUTO_STEP_MS);
        return Math.max(o.stage, timed);
    }

    // ---------- Static files ----------

    static void files(HttpExchange x) throws IOException {
        String p = x.getRequestURI().getPath();
        if (p.equals("/")) p = "/index.html";
        Path f = WEB.resolve(p.substring(1)).normalize();
        if (!f.startsWith(WEB) || !Files.isRegularFile(f)) { send(x, 404, "Not found", "text/plain"); return; }
        String n = f.getFileName().toString();
        String type = n.endsWith(".html") ? "text/html" : n.endsWith(".css") ? "text/css"
            : n.endsWith(".js") ? "text/javascript" : "application/octet-stream";
        send(x, 200, new String(Files.readAllBytes(f), StandardCharsets.UTF_8), type);
    }

    // ---------- Helpers ----------

    static Map<String, String> form(String body) {
        Map<String, String> map = new HashMap<>();
        for (String part : body.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2) map.put(URLDecoder.decode(kv[0], StandardCharsets.UTF_8), URLDecoder.decode(kv[1], StandardCharsets.UTF_8));
        }
        return map;
    }

    static String q(String s) {
        return "\"" + s.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", " ").replace("\r", " ") + "\"";
    }

    static String error(String msg) { return "{\"error\":" + q(msg) + "}"; }

    static String json(Dish d) {
        return "{\"id\":" + q(d.id()) + ",\"name\":" + q(d.name()) + ",\"category\":" + q(d.category())
            + ",\"desc\":" + q(d.desc()) + ",\"price\":" + d.price() + ",\"mins\":" + d.mins() + ",\"veg\":" + d.veg() + "}";
    }

    static String json(Order o) {
        String items = o.items.entrySet().stream()
            .map(e -> "{\"name\":" + q(e.getKey()) + ",\"qty\":" + e.getValue() + "}").collect(Collectors.joining(","));
        String stages = Arrays.stream(STAGES).map(Main::q).collect(Collectors.joining(","));
        return "{\"id\":" + o.id + ",\"name\":" + q(o.name) + ",\"phone\":" + q(o.phone) + ",\"address\":" + q(o.address)
            + ",\"total\":" + o.total + ",\"stage\":" + stageOf(o) + ",\"stages\":[" + stages + "],\"items\":[" + items + "]}";
    }

    static void send(HttpExchange x, int code, String body) throws IOException { send(x, code, body, "application/json"); }

    static void send(HttpExchange x, int code, String body, String type) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        x.getResponseHeaders().set("Content-Type", type + "; charset=utf-8");
        x.sendResponseHeaders(code, bytes.length);
        try (var out = x.getResponseBody()) { out.write(bytes); }
    }
}
