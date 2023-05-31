#include lomo:shaders/lib/ray.glsl
#include lomo:shaders/lib/plane.glsl

struct ray_plane_intersection_result {
	bool success;
	float dist;
};

ray_plane_intersection_result ray_plane_intersection(ray r, plane p) {
	
	vec3 d = r.dir;
	vec3 n = p.normal;

	float nd = dot(n, d);

	if(nd != 0) {
		return ray_plane_intersection_result(true, -(p.d + dot(n, r.pos)) / nd);
	}

	return ray_plane_intersection_result(false, 0);
}