import { setContext, drawColorWheel, getColorForPoint, hslToRgb, rgbToHex } from "./colorpick.js";

const canvas = $('#colorpick');
const ctx = canvas.getContext('2d');

setContext(ctx);
drawColorWheel();

window._cpickerGetColor = (cx, cy) =>
  rgbToHex(hslToRgb(getColorForPoint(cx, cy)))

