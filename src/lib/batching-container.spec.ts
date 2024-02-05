import { BatchingContainer } from "./batching-container";
import { ScrappedRow } from "./types";

describe(BatchingContainer.name, () => {
    it('should buffer the row if its under the limit', () => {
        const mockHandler = vi.fn()
        const bc = new BatchingContainer(10, mockHandler)
        bc.handle({ id: '1' } as ScrappedRow)

        expect(mockHandler).not.toHaveBeenCalled()
        expect(bc.getBufferedRows()).toHaveLength(1)
    })

    it('should send all buffered rows', () => {
        const mockHandler = vi.fn()
        const bc = new BatchingContainer(2, mockHandler)
        bc.handle({ id: '1' } as ScrappedRow)
        bc.handle({ id: '2' } as ScrappedRow)

        // Should be persisted
        bc.handle({ id: '3' } as ScrappedRow)

        expect(mockHandler).toHaveBeenCalled()
        expect(bc.getBufferedRows()).toHaveLength(1)
        expect(bc.getBufferedRows()[0].id).toEqual('3')
    })
})