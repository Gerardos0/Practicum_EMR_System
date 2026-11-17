import { listCoursesForUser } from "../../api/courses";
import { useAsync } from "../../utils/useAsync";
import { useSession } from "../auth/useSession";

/** PHAR 5320 is the pharmacy chart. PHYT 6310 is the nursing chart. */
export function usePharmacyCourse(): boolean {
  const { user, courseId, discipline } = useSession();
  const courses = useAsync(() => listCoursesForUser(), [user.id]);
  const course = courses.data?.find((item) => item.id === courseId);
  if (course?.track === "pharmacy" || course?.track === "nursing") return course.track === "pharmacy";
  if (course?.code) return course.code.startsWith("PHAR");
  return discipline === "pharmacy";
}
