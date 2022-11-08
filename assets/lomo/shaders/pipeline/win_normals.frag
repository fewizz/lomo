#include frex:shaders/api/header.glsl
#include canvas:shaders/pipeline/pipeline.glsl
#include lomo:shaders/lib/transform.glsl
#include lomo:shaders/lib/ray_plane.glsl

/* lomo:pipeline/win_normals.frag */

uniform sampler2D u_depths;
uniform sampler2D u_normals;

layout(location = 0) out vec3 out_normal;
layout(location = 1) out float out_depth;

void main() {
	float depth_ws = texelFetch(u_depths, ivec2(gl_FragCoord.xy), 0).r;
	vec3 pos_win = vec3(gl_FragCoord.xy, depth_ws);

	vec3 pos_ndc = win_to_ndc(pos_win);
	float depth_ndc = win_z_to_ndc(depth_ws);

	vec3 pos_cam = win_to_cam(pos_win);

	vec3 normal_cam = texelFetch(u_normals, ivec2(gl_FragCoord.xy), 0).xyz;

	if(length(normal_cam) < 0.5) {
		out_normal = vec3(0.0, 0.0, -1.0);
		out_depth = 1.0;
		return;
	}

	//normal_cam = normalize(normal_cam);
	if(dot(normal_cam, cam_dir_to_z1(gl_FragCoord.xy)) > 0) normal_cam *= -1;

	plane p = plane_from_pos_and_normal(pos_cam, normal_cam);

	vec3 points[2];

	for(int d = 0; d < 2; ++d) {
		vec2 add = vec2(0);
		add[d] = 1.0;

		vec2 pos_win0 = pos_win.xy + add;

		ray r = ray(cam_near(pos_win0), cam_dir_to_z1(pos_win0));

		ray_plane_intersection_result res = ray_plane_intersection(r, p);
		points[d] = r.pos + r.dir * res.dist;
	}

	vec3 dir_x_ndc = cam_to_ndc(points[0]) - pos_ndc;
	vec3 dir_y_ndc = cam_to_ndc(points[1]) - pos_ndc;

	vec3 norm = cross(dir_y_ndc, dir_x_ndc);
	//norm.z /= 2.0;
	norm = normalize(norm);
	norm.y = clamp(norm.y, -0.1, 0.1);
	norm = normalize(norm);
	out_normal = norm;

	p = plane_from_pos_and_normal(pos_ndc, norm);
	float min_depth = depth_ndc;

	for(int x = -1; x <= 1; x+=2) {
		for(int y = -1; y <= 1; y+=2) {
			ray r = ray(
				(
					vec3(pos_ndc.xy, -1.0) +
					vec3(x, y, 0) / 2.0 / vec3(frxu_size.xy / 2.0, 1.0)
				),
				vec3(0, 0, 1)
			);
			ray_plane_intersection_result res = ray_plane_intersection(r, p);
			min_depth = min(min_depth, (r.pos + r.dir * res.dist).z);
		}
	}

	out_depth = ndc_z_to_win(min_depth);
}