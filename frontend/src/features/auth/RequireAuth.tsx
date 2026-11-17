import { Navigate, Outlet, useLocation } from "react-router-dom";
import type { Role } from "../../types";
import { homePathFor } from "../../utils/permissions";
import { useAuth } from "./useSession";

interface Props {
  roles?: Role[];
  needsCourse?: boolean;
  courseOptionalFor?: Role[];
}

export default function RequireAuth({ roles, needsCourse = true, courseOptionalFor }: Props) {
  const { session } = useAuth();
  const location = useLocation();

  if (!session) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  if (session.mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  const courseOptional = courseOptionalFor?.includes(session.activeRole) ?? false;
  if (needsCourse && !session.courseId && !courseOptional) return <Navigate to="/select-course" replace />;
  if (roles && !roles.includes(session.activeRole)) {
    return <Navigate to={homePathFor(session.activeRole)} replace />;
  }
  return <Outlet />;
}
