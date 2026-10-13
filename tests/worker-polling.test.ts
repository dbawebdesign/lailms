/** @jest-environment node */
import { AdaptivePollDelay, intervalMs, schedulePeriodic } from '../src/lib/services/worker-polling';

describe('worker scheduling', () => {
  afterEach(() => jest.useRealTimers());
  it('backs off idle polling to 30 seconds and returns to fast polling after work', () => {
    const delay = new AdaptivePollDelay(2000, 30000);
    expect(Array.from({ length: 7 }, () => delay.next(false))).toEqual([2000,4000,8000,16000,30000,30000,30000]);
    expect(delay.next(true)).toBe(2000);
    expect(delay.next(false)).toBe(2000);
  });
  it.each(['', 'NaN', '-1', '0', 'Infinity', '999999', '5ms'])('does not spin on invalid interval %s', value => {
    expect(intervalMs(value,5000)).toBe(5000);
  });
  it('keeps the existing 2-second active interval', () => expect(intervalMs('2000',5000)).toBe(2000));
  it('never overlaps slow periodic calls and can stop while a call is pending', async () => {
    jest.useFakeTimers();
    let finish!: () => void;
    const task = jest.fn(() => new Promise<void>(resolve => { finish=resolve; }));
    const stop = schedulePeriodic(task,300000,jest.fn());
    await jest.advanceTimersByTimeAsync(300000);
    await jest.advanceTimersByTimeAsync(900000);
    expect(task).toHaveBeenCalledTimes(1);
    stop(); finish();
    await jest.advanceTimersByTimeAsync(900000);
    expect(task).toHaveBeenCalledTimes(1);
  });
  it('continues after a failed health request without a tight retry loop', async () => {
    jest.useFakeTimers();
    const error = new Error('unavailable');
    const task=jest.fn().mockRejectedValue(error), report=jest.fn();
    const stop=schedulePeriodic(task,300000,report);
    await jest.advanceTimersByTimeAsync(600000);
    expect(task).toHaveBeenCalledTimes(2); expect(report).toHaveBeenCalledWith(error);
    stop();
  });
});
