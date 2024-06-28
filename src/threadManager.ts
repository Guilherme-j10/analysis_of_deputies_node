import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { Worker } from "node:worker_threads";
import { z } from "zod"; 

const ReciveInMainPayloadThreadProtocol = z.object({
  head: z.string(),
  threadId: z.number(),
  payload: z.any()
})

export type ReciveInMainPayloadThreadProtocolType = z.output<typeof ReciveInMainPayloadThreadProtocol>;
export type ThreadsStoreType = {
  threadId: number,
  workerInstance: Worker,
  initializeThread: () => void
}

class ThreadManager {
  public threadsStore = [] as ThreadsStoreType[];
  private threadFileTargetLocation = path.resolve(__dirname, "..", "thread");

  constructor(
    private threadFileName: string,
    private threadFileSourceLocation: string
  ) {
    this.threadFileTargetLocation = path.join(
      this.threadFileTargetLocation, 
      this.threadFileName.replace(".ts", ".js")
    );
  }

  async pushNewThread(
    callbackEvent: (event: ReciveInMainPayloadThreadProtocolType, threadInstance: Worker) => void,
    threadData: any
  ): Promise<void> {
    const threadFileSourceLocation = path.join(this.threadFileSourceLocation, this.threadFileName);
    let threadFileTargetLocation = "";

    if (fs.existsSync(this.threadFileTargetLocation)) {
      threadFileTargetLocation = this.threadFileTargetLocation;
    }

    if (!threadFileTargetLocation.length) {
      execSync(`npx tsc ${threadFileSourceLocation} --outDir thread`);
      threadFileTargetLocation = this.threadFileTargetLocation;
    }

    const threadElement: ThreadsStoreType = {
      workerInstance: {} as Worker,
      threadId: 0,
      initializeThread() {
        this.workerInstance = new Worker(threadFileTargetLocation);
        this.threadId = this.workerInstance.threadId;

        this.workerInstance.postMessage({
          head: "threadId",
          data: this.threadId
        });

        this.workerInstance.postMessage({
          head: "threadData",
          data: threadData
        });

        this.workerInstance.on("message", (e) => {
          callbackEvent(
            ReciveInMainPayloadThreadProtocol.parse(e), 
            this.workerInstance
          );
        });
      },
    };

    threadElement.initializeThread();
    this.threadsStore.push(threadElement);
  }

  async removeThread(threadId: number): Promise<boolean> {
    const [thread] = this.threadsStore.filter(t => t.threadId === threadId);

    if (!thread?.threadId)
      throw new Error("Thread not found");

    thread.workerInstance.postMessage({ head: "closeThread" });
    thread.workerInstance.removeAllListeners();

    this.threadsStore = this.threadsStore.filter(t => t.threadId !== threadId);
    return true;
  }

  listThreads(): number[] {
    return this.threadsStore.map(t => t.threadId);
  }
};

export const threadManager = new ThreadManager(
  "thread.ts",
  path.resolve(__dirname, ".")
);