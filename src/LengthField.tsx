import { Field, type FieldProps, makeStyles, mergeClasses, tokens } from '@fluentui/react-components';
import React from 'react';
import { DEFAULT_LENGTH_SCALE, type LengthUnit, useLengthUnit } from './LengthUnitContext';
import { useScene } from './SceneProvider';
import { type CustomSpinButtonProps, SpinButton } from './SpinButton';

export const LengthUnitToggle: React.FC = () => {
    const classes = useStyles();
    const [unit, setUnit] = useLengthUnit();
    const toggle = () => setUnit(unit === 'px' ? 'yalm' : 'px');

    return (
        <div
            className={classes.toggle}
            onClick={toggle}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && toggle()}
        >
            <div className={mergeClasses(classes.unitBtn, unit === 'px' && classes.unitBtnActive)}>px</div>
            <div className={mergeClasses(classes.unitBtn, unit === 'yalm' && classes.unitBtnActive)}>y</div>
        </div>
    );
};

export interface LengthFieldProps {
    label?: FieldProps['label'];
    className?: string;
    value: number | undefined;
    onChange?: CustomSpinButtonProps['onChange'];
    onValueChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
}

function toDisplay(px: number | undefined, unit: LengthUnit, ppy: number): number | undefined {
    return px === undefined ? undefined : unit === 'yalm' ? px / ppy : px;
}

function toPx(display: number, unit: LengthUnit, ppy: number): number {
    return unit === 'yalm' ? Math.round(display * ppy) : display;
}

export const LengthField: React.FC<LengthFieldProps> = ({
    label,
    className,
    value,
    onChange,
    onValueChange,
    min,
    max,
    step = 1,
}) => {
    const classes = useStyles();
    const [unit] = useLengthUnit();
    const { scene } = useScene();
    const ppy = scene.arena.lengthScale ?? DEFAULT_LENGTH_SCALE;

    const wrappedOnChange: CustomSpinButtonProps['onChange'] = (e, data) => {
        if (!onChange && !onValueChange) return;
        if (data.value === undefined || data.value === null) {
            onChange?.(e, data);
            return;
        }
        const pxValue = toPx(data.value, unit, ppy);
        onChange?.(e, { ...data, value: pxValue, displayValue: String(pxValue) });
        onValueChange?.(pxValue);
    };

    return (
        <Field label={label} className={className}>
            <div className={classes.control}>
                <SpinButton
                    value={toDisplay(value, unit, ppy)}
                    onChange={wrappedOnChange}
                    min={toDisplay(min, unit, ppy)}
                    max={toDisplay(max, unit, ppy)}
                    step={unit === 'yalm' ? step / ppy : step}
                    fractionDigits={unit === 'yalm' ? 2 : 0}
                />
                <LengthUnitToggle />
            </div>
        </Field>
    );
};

const useStyles = makeStyles({
    control: {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: tokens.spacingHorizontalXS,
    },
    toggle: {
        display: 'flex',
        flexDirection: 'column',
        gap: tokens.spacingVerticalXXS,
        flexShrink: 0,
        cursor: 'pointer',
    },
    unitBtn: {
        fontSize: '9px',
        lineHeight: '10px',
        padding: '0px 3px 1px',
        textAlign: 'center',
        border: `1px solid ${tokens.colorNeutralStroke1}`,
        borderRadius: tokens.borderRadiusSmall,
        background: tokens.colorNeutralBackground1,
        color: tokens.colorNeutralForeground1,
    },
    unitBtnActive: {
        background: tokens.colorBrandBackground,
        color: tokens.colorNeutralForegroundOnBrand,
        border: `1px solid ${tokens.colorBrandBackground}`,
    },
});
