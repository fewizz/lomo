#include frex:shaders/api/header.glsl
#include lomo:shaders/lib/transform.glsl

/* lomo:pipeline/post.frag */

uniform sampler2D u_reflective;

uniform sampler2D u_main;
uniform sampler2D u_depth;

in vec2 _cvv_texcoord;
out vec4 out_color;

struct reflection_result {
	bool success;
	vec4 color;
	float a;
};

#define CELL_SIZE 4

const int last_level = 5;

float dist_f(float v0, float cell_size, float d) {
	float s = sign(d);
	float fr = fract(v0 / cell_size) * cell_size;
	const float E = 0.001;
	const float C = 1.0 + E;

	if(fr <= E) return s * cell_size * C;
	if(s > 0.0) return (cell_size - fr) * C;
	return -fr * C;
}

ivec2 texture_coord(vec3 coord_lod_0, float cell_size) {
	return ivec2(coord_lod_0.xy / cell_size);
}

float upper_depth(ivec2 coord, int lod) {
	if(lod < last_level)
		return texelFetch(u_depth, coord / CELL_SIZE, lod + 1).r;
	return 0.0;
}

reflection_result reflection(vec3 dir_ws, vec3 pos_ws) {
	// that's possible
	for(int d = 0; d < 3; d++) {
		if(dir_ws[d] == 0.0) {
			dir_ws[d] == 0.0001;
		}
	}
	dir_ws = normalize(dir_ws);
	vec2 dir = normalize(dir_ws.xy);

	// primary axis in window space
	int prim = abs(dir.x) >= abs(dir.y) ? 0 : 1;
	// secondary
	int sec = 1 - prim;

	ivec2 idir = ivec2(sign(dir));

	float sec_to_prim = dir[sec] / dir[prim];
	float dist_per_prim = 1.0 / dir[prim];
	float dist_per_sec = 1.0 / dir[sec];

	// current windows space position
	vec3 cur = vec3(0);
	cur.xy = floor(pos_ws.xy) + vec2(0.5);
	cur.z = pos_ws.z;

	// texture coord for current lod
	int lod = 0;
	float cell_size = 1;
	ivec2 coord = texture_coord(cur, cell_size);

	float upper_depth_ws = 0.0;

	bool backwards = dir_ws.z <= 0.0;
	float dir_ws_xy_length = length(dir_ws.xy);
	float dir_ws_z_per_xy = dir_ws.z / dir_ws_xy_length;
	vec3 prev = cur;

	int steps = 0;
	while(true) {
		// should we use lower lod?
		float depth_ws = texelFetch(u_depth, coord, lod).r;
		while((cur.z > depth_ws || (!backwards && cur.z == depth_ws)) && lod > 0) {
			--lod;
			cell_size /= CELL_SIZE;
			coord = texture_coord(cur, cell_size);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		// should we use higher lod?
		while((cur.z < upper_depth_ws || (backwards && cur.z == upper_depth_ws)) && lod < last_level) {
			++lod;
			cell_size *= CELL_SIZE;
			coord = texture_coord(cur, cell_size);
			depth_ws = upper_depth_ws;
			upper_depth_ws = upper_depth(coord, lod);
		}

		vec3 next = vec3(0);

		while(true) {
			float prim_dist = dist_f(cur[prim], cell_size, dir[prim]);
			float sec_dist = dist_f(cur[sec], cell_size, dir[sec]);

			float sec_to_prim0 = sec_dist / prim_dist;

			float dist_add = 0;
			if(abs(sec_to_prim0) < abs(sec_to_prim))
				dist_add = sec_dist * dist_per_sec;
			else
				dist_add = prim_dist * dist_per_prim;

			next = cur;
			next.xy += dir*dist_add;
			next.z += dist_add*dir_ws_z_per_xy;

			vec3 mid = (cur + next)/2.0;

			bool collides = cur.z >= depth_ws || next.z >= depth_ws;

			// yeah, i could simplify this and next statement
			// but AMD driver crashes because of that :concern:
			if(lod == 0) {
				if(collides) {
					vec4 packed_normal = texelFetch(u_reflective, coord, 0);
					vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
					mat3 rotation = mat3(frx_viewMatrix());
					vec3 normal_cs = normalize(rotation * normal);

					vec2 mid_center_ws = floor(mid.xy) + vec2(0.5);
					vec3 normal_origin_ws = 
						vec3(
							mid_center_ws,
							depth_ws
						);
					vec3 normal_origin_cs = win_to_cam(normal_origin_ws, frx_projectionMatrix());

					float f = farthest(
						normal_origin_cs, normal_cs, frx_projectionMatrix()
					);

					if(
						length(packed_normal.xyz) > 0.5
						&&
						(
							(!backwards && cur.z  > depth_ws+f*2)
							||
							( backwards && next.z > depth_ws+f*2)
						)
					) {
						return reflection_result(true, vec4(0), 1 );
					}

					vec4 color = texelFetch(u_main, coord, 0);
					return reflection_result(
						true,
						color,
						1
					);
				}
				break;
			}

			if(!collides || backwards)
				break;

			--lod;
			cell_size /= CELL_SIZE;
			coord = texture_coord(cur, cell_size);
			upper_depth_ws = depth_ws;
			depth_ws = texelFetch(u_depth, coord, lod).r;
		}

		prev = cur;
		cur = next;
		coord = texture_coord(cur, cell_size);

		int cells = int(cell_size * CELL_SIZE);

		if(ivec2(prev) / cells != ivec2(cur) / cells)
			upper_depth_ws = upper_depth(coord, lod);

		if(
			cur.x <= 0.0 || cur.x >= frxu_size.x ||
			cur.y <= 0.0 || cur.y >= frxu_size.y ||
			cur.z <= 0.0 || cur.z >= 1.0
		) {
			return reflection_result(false, vec4(0.0), 0.0);
		}

		if(++steps > 150) return reflection_result(true, vec4(0.0), 0.0);
	}
}

void main() {
	vec4 packed_normal = texture2D(u_reflective, _cvv_texcoord);

	vec4 reflection_color = vec4(0);
	float ratio = 0;

	if(packed_normal.a != 0) {
		vec3 normal = normalize((packed_normal.xyz - 0.5) * 2);
		mat4 view = frx_viewMatrix();
		mat4 proj = frx_projectionMatrix();

		float depth_ws = texelFetch(u_depth, ivec2(gl_FragCoord.xy), 0).r ;
		vec3 position_ws = vec3(gl_FragCoord.xy, depth_ws);
		vec3 position_cs = win_to_cam(position_ws, proj);

		mat3 rotation = mat3(view);
		vec3 normal_cs = normalize(rotation * normal);

		vec3 reflection_dir = reflect(normalize(position_cs), normal_cs);

		vec3 dir_ws = cam_dir_to_win(position_cs, reflection_dir, proj);

		// applying z offset
		float z_per_xy = dir_ws.z / length(dir_ws.xy);
		position_ws.z -= abs(z_per_xy)*3 + 0.0001;

		reflection_result res = reflection(dir_ws, position_ws);

		if(res.success) {
			reflection_color = res.color;

		//#if REFLECTION_SOFT_EDGE = LOMO_REFLECTION_SOFT_EDGE_TRUE
		//	vec3 into_camera = normalize(-position_cs);
		//	float cos_between_normal_and_ray = dot(into_camera, normal_cs);
		//	float sin_between_normal_and_ray = sqrt(1 - cos_between_normal_and_ray*cos_between_normal_and_ray);
			ratio = 1;//res.a;//*sin_between_normal_and_ray;
			//return;
		}
	}

	out_color = mix(texture(u_main, _cvv_texcoord), reflection_color, ratio);
}