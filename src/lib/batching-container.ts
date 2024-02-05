import { ScrappedRow } from "./types";

export class BatchingContainer {
    private readonly bufferedRows: Array<ScrappedRow> = []

    constructor(
        private readonly size = 10,
        private readonly handler: (rows: Array<ScrappedRow>) => void
    ) { }

    public handle(row: ScrappedRow) {
        this.bufferedRows.push(row)

        if (this.bufferedRows.length >= this.size) {
            const rowsToProcess = this.bufferedRows.splice(0, this.size);
            this.handler(rowsToProcess)
        }
    }

    public getBufferedRows() {
        return this.bufferedRows
    }
}