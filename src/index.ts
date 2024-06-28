import axios from "axios";
import { parse } from "node-html-parser";
import { ReciveInMainPayloadThreadProtocolType, threadManager } from "./threadManager";
import { Worker } from "node:worker_threads";

type DeputieListSource = {
  name: string,
  link: string,
  tag: string
}

(async () => {
  let page = 1;
  let continueScrapingList = true;
  let deputiesList = [] as DeputieListSource[];
  let threadsAmount = 40;

  while (continueScrapingList) {
    const baseUrl = `https://www.camara.leg.br/deputados/quem-sao/resultado?search=&partido=&uf=&legislatura=&sexo=&pagina=${page}`;
    console.log("scraping page -> " + baseUrl);
    const response = await axios.get(baseUrl, {
      responseType: "document"
    });

    const avaliableTags = ["Em exercício", "Licenciado"];
    let scrapedElements = [] as DeputieListSource[];

    const root = parse(response.data);
    const deputiesSource = root.querySelectorAll('[class="lista-resultados__cabecalho"]');

    for (const source of deputiesSource) {
      const link = source.getElementsByTagName('a');
      const tag = source.childNodes[3].textContent;

      if (avaliableTags.includes(tag)) {
        scrapedElements.push({
          link: link[0].getAttribute("href") as string,
          name: link[0].textContent,
          tag
        });
      }
    }

    if (!scrapedElements.length) {
      continueScrapingList = false;
    }

    deputiesList = [
      ...deputiesList,
      ...scrapedElements
    ];

    page++;
  }

  const callbackData = (
    event: ReciveInMainPayloadThreadProtocolType,
    threadInstance: Worker
  ) => {
    console.log("RECIVED DATA IN MAIN: ", event.payload.length);

    threadInstance.postMessage({
      head: "closeThread",
      data: undefined
    })
  }

  const benches = new Map();
  const totalItemsPerBench = Math.trunc(deputiesList.length / threadsAmount);

  for (let i = 0; i < threadsAmount; i++) {
    let bench = [];

    for (let x = 0; x < totalItemsPerBench; x++) {
      bench.push(deputiesList[0]);
      deputiesList.splice(0, 1);
    }

    if (i == (threadsAmount - 1)) {
      for (const el of deputiesList) {
        bench.push(el);
      }
    }

    benches.set(i, bench);
  }

  for (let i = 0; i < threadsAmount; i++) {
    threadManager.pushNewThread(
      callbackData,
      benches.get(i)
    );
  }
})();