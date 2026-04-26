function write(level, message, data) {
    const payload = {
        ts: new Date().toISOString(),
        level,
        message,
        ...(data ? { data } : {})
    };
    const line = JSON.stringify(payload);
    if (level === "error") {
        console.error(line);
        return;
    }
    console.log(line);
}
export const logger = {
    info(message, data) {
        write("info", message, data);
    },
    warn(message, data) {
        write("warn", message, data);
    },
    error(message, data) {
        write("error", message, data);
    }
};
