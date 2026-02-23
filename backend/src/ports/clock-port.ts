export type ClockPort = Readonly<{
  now: () => Date;
}>;

export const systemClock: ClockPort = {
  now: () => new Date(),
};
