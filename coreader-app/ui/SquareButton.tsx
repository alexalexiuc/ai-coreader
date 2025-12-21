import { Button } from './Button';

type SquareButtonProps = React.PropsWithChildren<{
  onClick: () => void;
  title: string;
}>;

export const SquareButton: React.FC<SquareButtonProps> = ({ onClick, title, children }) => {
  return (
    <Button onClick={onClick} title={title} aria-label={title} paddingClass="p-2" textSizeClass="">
      {children}
    </Button>
  );
};
