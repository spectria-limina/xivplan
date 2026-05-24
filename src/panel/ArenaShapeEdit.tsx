import { Field } from '@fluentui/react-components';
import {
    BorderNoneFilled,
    BorderNoneRegular,
    CircleFilled,
    CircleRegular,
    SquareFilled,
    SquareRegular,
    bundleIcon,
} from '@fluentui/react-icons';
import React from 'react';
import { DEFAULT_LENGTH_SCALE } from '../LengthUnitContext';
import { ArenaShape } from '../scene';
import { useScene } from '../SceneProvider';
import { Segment, SegmentedGroup } from '../Segmented';
import { SpinButton } from '../SpinButton';
import { useControlStyles } from '../useControlStyles';

const CircleIcon = bundleIcon(CircleFilled, CircleRegular);
const SquareIcon = bundleIcon(SquareFilled, SquareRegular);
const BorderNoneIcon = bundleIcon(BorderNoneFilled, BorderNoneRegular);

export const ArenaShapeEdit: React.FC = () => {
    const classes = useControlStyles();
    const { scene, dispatch } = useScene();
    const { shape, width, height, padding, lengthScale = DEFAULT_LENGTH_SCALE } = scene.arena;

    const onWidthChanged = (value: number) => dispatch({ type: 'arenaWidth', value });
    const onHeightChanged = (value: number) => dispatch({ type: 'arenaHeight', value });
    const onPaddingChanged = (value: number) => dispatch({ type: 'arenaPadding', value });
    const onLengthScaleChanged = (value: number) => dispatch({ type: 'arenaLengthScale', value });

    return (
        <div className={classes.column}>
            <div className={classes.row}>
                <Field label="Arena shape" className={classes.cell}>
                    <SegmentedGroup
                        name="arena-shape"
                        value={shape}
                        onChange={(ev, data) => dispatch({ type: 'arenaShape', value: data.value as ArenaShape })}
                    >
                        <Segment value={ArenaShape.None} icon={<BorderNoneIcon />} title="None" />
                        <Segment value={ArenaShape.Circle} icon={<CircleIcon />} title="Circle" />
                        <Segment value={ArenaShape.Rectangle} icon={<SquareIcon />} title="Rectangle" />
                    </SegmentedGroup>
                </Field>
                <Field label="Padding" className={classes.cell}>
                    <SpinButton min={0} max={500} step={10} value={padding} onValueChange={onPaddingChanged} />
                </Field>
            </div>
            <div className={classes.row}>
                <Field label="Width">
                    <SpinButton min={50} max={2000} step={50} value={width} onValueChange={onWidthChanged} />
                </Field>
                <Field label="Height">
                    <SpinButton min={50} max={2000} step={50} value={height} onValueChange={onHeightChanged} />
                </Field>
            </div>
            <div className={classes.row}>
                <Field label="Pixels/yalm" className={classes.cell}>
                    <SpinButton min={1} max={100} step={1} value={lengthScale} onValueChange={onLengthScaleChanged} />
                </Field>
            </div>
        </div>
    );
};
