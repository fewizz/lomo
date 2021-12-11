#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_plane.glsl

/* lomo:pipeline/win_normals.frag */

uniform sampler2DArray u_depths;
uniform sampler2DArray u_normals;

out vec4 out_normal;

void main() {
	float depth_ws = texelFetch(u_depths, ivec3(gl_FragCoord.xy, 0), 0).r;
	vec3 pos_win = vec3(gl_FragCoord.xy, depth_ws);
	vec3 pos_cam = win_to_cam(pos_win);

	vec3 normal_cam = normalize(texelFetch(u_normals, ivec3(gl_FragCoord.xy, 0), 0).xyz);
	plane p = plane_from_pos_and_normal(pos_cam, normal_cam);

	vec3 points[2];

	for(int d = 0; d < 2; ++d) {
		vec2 add = vec2(0);
		add[d] = 1.0;

		vec2 pos_win0 = pos_win.xy + add;
		vec3 near_cam = win_to_cam(vec3(pos_win0, 0)); // point in near plane
		vec3 far_cam = win_to_cam(vec3(pos_win0, 1)); // point in far plane

		vec3 dir_cam = normalize(far_cam-near_cam);
		ray r = ray(near_cam, dir_cam);

		ray_plane_intersection_result res = ray_plane_intersection(r, p);
		points[d] = near_cam + dir_cam * res.dist;
	}

	vec3 dir_x_win = cam_to_win(points[0]);
	vec3 dir_y_win = cam_to_win(points[1]);

	out_normal = vec4(
		normalize(
			cross(
				cam_to_win(points[0]) - pos_win,
				cam_to_win(points[1]) - pos_win
			)
		),
		1.0
	);
}