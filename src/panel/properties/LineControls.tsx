import { mergeClasses } from '@fluentui/react-components';
import { LengthField } from '../../LengthField';
import { MIN_LINE_LENGTH, MIN_LINE_WIDTH } from '../../prefabs/bounds';
import type { LineZone } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { useObjectUpdater } from '../../useObjectUpdater';
import { commonValue } from '../../util';
import type { PropertiesControlProps } from '../PropertiesControl';

export const LineSizeControl: React.FC<PropertiesControlProps<LineZone>> = ({ objects }) => {
    const classes = useControlStyles();
    const update = useObjectUpdater(objects);

    const width = commonValue(objects, (obj) => obj.width);
    const length = commonValue(objects, (obj) => obj.length);

    const onWidthChanged = (width: number) => update({ props: { width } });
    const onLengthChanged = (length: number) => update({ props: { length } });

    return (
        <div className={mergeClasses(classes.row, classes.rightGap)}>
            <LengthField label="Width" value={width} onValueChange={onWidthChanged} min={MIN_LINE_WIDTH} step={5} />
            <LengthField label="Length" value={length} onValueChange={onLengthChanged} min={MIN_LINE_LENGTH} step={5} />
        </div>
    );
};
