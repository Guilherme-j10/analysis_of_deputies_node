import { parentPort } from "node:worker_threads";
import axios from 'axios';
import { parse } from "node-html-parser";

type ReciveInThreadPayloadProtocol = {
  head: string,
  data: any
}

type SendToMainPayloadThreadProtocol = {
  head: string,
  threadId: string,
  payload: any
}

type DeputieListSource = {
  name: string,
  link: string,
  tag: string
}

interface ScrappedData extends DeputieListSource {
  birthDate: string,
  origin: string
}

let threadId = "";

const initializeMainScrape = async (data: DeputieListSource[]) => {
  let finishedScrapedData = [] as ScrappedData[];

  for (const deputie of data) {
    let response;
    while (true) {
      try {
        response = await axios.get(deputie.link, {
          responseType: "document"
        });

        if (response.status !== 504) {
          break;
        }
      } catch {}
    }

    const root = parse(response.data);
    const ulTag = root.querySelectorAll('[class="informacoes-deputado"]')[0];
    const liTags = ulTag.querySelectorAll('li');

    const date = liTags.filter(d => d.innerText.startsWith("Data"))[0];
    const origin = liTags.filter(d => d.innerText.startsWith("Natu"))[0];

    console.log(`Scraping -- name: ${deputie.name} | ${date.innerText.trim()}`);

    finishedScrapedData.push({
      ...deputie,
      birthDate: date.innerText.trim(),
      origin: origin.innerText.trim().split('\n')[1].trim()
    })
  }

  parentPort?.postMessage({
    head: "finishedScrap",
    threadId,
    payload: finishedScrapedData
  } as SendToMainPayloadThreadProtocol)
}

parentPort?.on("message", (payloadMessage: ReciveInThreadPayloadProtocol) => {
  if (payloadMessage.head === "threadId") {
    threadId = payloadMessage.data as string;
  }

  if (payloadMessage.head === "threadData") {
    initializeMainScrape(payloadMessage.data);
  }

  if (payloadMessage.head === "closeThread") {
    process.exit(0);
  }
});