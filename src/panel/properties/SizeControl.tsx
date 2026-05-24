import { mergeClasses } from '@fluentui/react-components';
import React from 'react';
import { LengthField } from '../../LengthField';
import { MIN_SIZE } from '../../prefabs/bounds';
import { useSpinChanged } from '../../prefabs/useSpinChanged';
import type { ResizeableObject } from '../../scene';
import { useControlStyles } from '../../useControlStyles';
import { useObjectUpdater } from '../../useObjectUpdater';
import { commonValue } from '../../util';
import type { PropertiesControlProps } from '../PropertiesControl';

export const SizeControl: React.FC<PropertiesControlProps<ResizeableObject>> = ({ objects }) => {
    const classes = useControlStyles();
    const update = useObjectUpdater(objects);

    const width = commonValue(objects, (obj) => obj.width);
    const height = commonValue(objects, (obj) => obj.height);

    const onWidthChanged = useSpinChanged((width: number) => update({ props: { width } }));
    const onHeightChanged = useSpinChanged((height: number) => update({ props: { height } }));

    return (
        <div className={mergeClasses(classes.row, classes.rightGap)}>
            <LengthField label="Width" value={width} onChange={onWidthChanged} min={MIN_SIZE} step={5} />
            <LengthField label="Height" value={height} onChange={onHeightChanged} min={MIN_SIZE} step={5} />
        </div>
    );
};
