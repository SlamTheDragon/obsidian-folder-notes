import { describe, it, expect } from 'bun:test';
import { VaultWriteQueue } from '../src/backend/overview/VaultWriteQueue';

describe('VaultWriteQueue Mutex & Concurrency', () => {
	it('executes asynchronous tasks sequentially without race conditions', async () => {
		const queue = new VaultWriteQueue();
		const executionOrder: number[] = [];

		const task1 = queue.enqueueTask(async () => {
			await new Promise((resolve) => setTimeout(resolve, 30));
			executionOrder.push(1);
			return 'result1';
		});

		const task2 = queue.enqueueTask(async () => {
			await new Promise((resolve) => setTimeout(resolve, 10));
			executionOrder.push(2);
			return 'result2';
		});

		const task3 = queue.enqueueTask(async () => {
			executionOrder.push(3);
			return 'result3';
		});

		const results = await Promise.all([task1, task2, task3]);
		expect(results).toEqual(['result1', 'result2', 'result3']);
		expect(executionOrder).toEqual([1, 2, 3]);
	});

	it('continues processing subsequent tasks even if a prior task throws an error', async () => {
		const queue = new VaultWriteQueue();
		const executionOrder: number[] = [];

		const failingTask = queue.enqueueTask(async () => {
			throw new Error('Simulated write failure');
		});

		const succeedingTask = queue.enqueueTask(async () => {
			executionOrder.push(2);
			return 'recovered';
		});

		await expect(failingTask).rejects.toThrow('Simulated write failure');
		const result = await succeedingTask;
		expect(result).toBe('recovered');
		expect(executionOrder).toEqual([2]);
	});
});
