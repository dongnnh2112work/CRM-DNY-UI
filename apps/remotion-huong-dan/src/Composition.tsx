import { Composition } from "remotion";
import { Tutorial1Min } from "./Tutorial1Min";

export const MyComposition = () => {
  return (
    <Composition
      id="CrmHuongDan1Min"
      component={Tutorial1Min}
      durationInFrames={1800}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
