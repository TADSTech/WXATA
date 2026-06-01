import { expect, test, describe, afterAll } from "bun:test";
import { storeMessage, getMessage, getMessageCount, pruneToMaxCapacity, pruneOldMessages, getMaxMessages, getRetentionDays } from "./db";
import { Database } from "bun:sqlite";
import path from "path";
import fs from "fs";

describe("WXATA SQLite Cache Tests", () => {
  const testMsgId = "test_msg_" + Date.now();
  const testJid = "123456789@s.whatsapp.net";

  test("Should store and retrieve a message correctly", () => {
    const mockMsg = {
      key: {
        id: testMsgId,
        remoteJid: testJid,
        participant: testJid,
        fromMe: false,
      },
      message: {
        conversation: "Hello, this is a test message!",
      },
    };

    storeMessage(mockMsg);

    const retrieved = getMessage(testMsgId);
    expect(retrieved).not.toBeNull();
    expect(retrieved.key.id).toBe(testMsgId);
    expect(retrieved.message.conversation).toBe("Hello, this is a test message!");
  });

  test("Should return null for non-existent message ID", () => {
    const retrieved = getMessage("non_existent_id");
    expect(retrieved).toBeNull();
  });

  test("Should report correct message count", () => {
    const count = getMessageCount();
    expect(count).toBeGreaterThan(0);
  });

  test("Should read dynamic retention days and max capacity settings", () => {
    const retention = getRetentionDays();
    const capacity = getMaxMessages();

    expect(typeof retention).toBe("number");
    expect(typeof capacity).toBe("number");
    expect(retention).toBeGreaterThan(0);
    expect(capacity).toBeGreaterThan(0);
  });

  test("Should successfully execute pruning procedures without errors", () => {
    // These should execute safely
    const prunedOld = pruneOldMessages();
    const prunedCap = pruneToMaxCapacity();

    expect(typeof prunedOld).toBe("number");
    expect(typeof prunedCap).toBe("number");
  });

  // Clean up our test message from SQLite to keep things pristine
  afterAll(() => {
    try {
      const DB_DIR = fs.existsSync("/data") ? "/data" : path.resolve(process.cwd(), "db");
      const db = new Database(path.join(DB_DIR, "messages.sqlite"));
      db.prepare("DELETE FROM messages WHERE id = ?").run(testMsgId);
    } catch (e) {
      console.error("Cleanup failed:", e);
    }
  });
});
