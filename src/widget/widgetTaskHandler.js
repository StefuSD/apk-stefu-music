import React from 'react';
import PlayerWidget from './PlayerWidget';
import { K_WIDGET, SCHEME, widgetContext } from './data';
import { renderWidget, WIDGETS } from './widgets';

/**
 * Обработчик виджетов (react-native-android-widget). Работает и когда
 * приложение открыто, и когда Android будит его ради виджета.
 *
 * Пока приложение в памяти, PlayerProvider кладёт в global.__stefuWidget
 * команды плеера и текущее состояние, а LinkHandler — global.__stefuLink:
 * кнопки виджетов выполняются сразу. Без приложения рисуем последний снимок
 * (src/widget/data.js), а кнопки открывают приложение ссылкой.
 */
export { K_WIDGET };

export async function widgetTaskHandler(props) {
  if (props.widgetAction === 'WIDGET_DELETED') return;
  const name = props.widgetInfo && props.widgetInfo.widgetName;
  const g = global.__stefuWidget;
  if (props.widgetAction === 'WIDGET_CLICK' && g) {
    try {
      if (props.clickAction === 'LINK') {
        const link = props.clickActionData && props.clickActionData.link;
        if (link && global.__stefuLink) global.__stefuLink(`${SCHEME}://${link}`);
      } else g.cmd(props.clickAction);
    } catch (e) { /* плеер занят */ }
  }
  if (WIDGETS.includes(name)) {
    const el = await renderWidget(name, props.widgetInfo);
    if (el) props.renderWidget(el);
    return;
  }
  // старый «Player» 4×1
  const { live, now } = await widgetContext();
  props.renderWidget(<PlayerWidget {...now} playing={!!(live && now.playing)} live={live} scheme={SCHEME} />);
}
