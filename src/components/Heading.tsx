import styles from './Heading.module.css';

type HeadingProps = {
  title: string;
  subtitle: string;
};

export function Heading({ title, subtitle }: HeadingProps) {
  return (
    <div className={styles.headingGroup}>
      <span className={styles.eyebrow}>Focus system</span>
      <h1 className={styles.heading} id="app-title">
        {title}
      </h1>
      <p>{subtitle}</p>
    </div>
  );
}
